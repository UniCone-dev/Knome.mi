/**
 * VisionBridgeService - "Eyes for the Brain"
 *
 * Synthetic tool executor for `describe_image` (like ReadMediaService, no
 * such tool exists on the server). When the active model can't see, but
 * another model loaded on this same router can, this lets the text model
 * ask that vision model directly: a small standalone chat-completion call
 * to the vision model, asking it to describe whatever image(s) are in the
 * current turn, with the answer handed back as plain text.
 *
 * Only meaningful in router mode (multiple models). Single-model mode has
 * nothing else to call, so the tool is never offered there -- see
 * `toolsStore.visionBridgeTool()`.
 *
 * @see buildDescribeImageToolDefinition in constants/vision-bridge.constants.ts
 * @see agenticStore in stores/agentic/index.svelte.ts - tool dispatch
 */

import { API_CHAT } from '$lib/constants';
import { ContentPartType } from '$lib/enums';
import { AttachmentType } from '$lib/enums';
import { getAuthHeaders, getJsonHeaders } from '$lib/utils/api-headers';
import type {
	ApiChatCompletionRequest,
	ApiChatCompletionResponse,
	ApiChatMessageContentPart,
	DatabaseMessage,
	DatabaseMessageExtra,
	DatabaseMessageExtraImageFile,
	ToolExecutionResult
} from '$lib/types';

const DEFAULT_QUESTION = 'Describe this image in detail, including any text visible in it.';

export class VisionBridgeService {
	/**
	 * Finds the most recent image attachment(s) in the conversation (usually
	 * the ones the user just sent this turn) and asks `visionModel` to
	 * describe them, returning its answer as the tool result content.
	 */
	static async describeImages(
		messages: DatabaseMessage[],
		visionModel: string,
		question: string | undefined,
		signal?: AbortSignal
	): Promise<ToolExecutionResult> {
		const images = VisionBridgeService.findLatestImages(messages);

		if (images.length === 0) {
			return {
				content:
					'Error: no image found in this conversation to look at. Ask the user to attach one first.',
				isError: true
			};
		}

		const contentParts: ApiChatMessageContentPart[] = images.map((base64Url) => ({
			image_url: { url: base64Url },
			type: ContentPartType.IMAGE_URL
		}));

		contentParts.push({
			text: question?.trim() || DEFAULT_QUESTION,
			type: ContentPartType.TEXT
		});

		const requestBody: ApiChatCompletionRequest = {
			messages: [{ content: contentParts, role: 'user' }],
			model: visionModel,
			stream: false
		};

		try {
			const response = await fetch(API_CHAT.COMPLETIONS, {
				body: JSON.stringify(requestBody),
				headers: { ...getJsonHeaders(), ...getAuthHeaders() },
				method: 'POST',
				signal
			});

			if (!response.ok) {
				const text = await response.text().catch(() => '');

				return {
					content: `Error: vision model request failed (HTTP ${response.status}). ${text.slice(0, 300)}`,
					isError: true
				};
			}

			const data = (await response.json()) as ApiChatCompletionResponse;
			const answer = data.choices?.[0]?.message?.content?.trim();

			if (!answer) {
				return { content: 'Error: vision model returned an empty response.', isError: true };
			}

			return { content: answer, isError: false };
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') throw error;

			return {
				content: `Error contacting the vision model: ${error instanceof Error ? error.message : String(error)}`,
				isError: true
			};
		}
	}

	/**
	 * Walks messages newest-first and returns every image attachment on the
	 * first message it finds that has one -- i.e. "the images from the most
	 * recent turn that included one", not every image ever sent in the chat.
	 */
	private static findLatestImages(messages: DatabaseMessage[]): string[] {
		for (let i = messages.length - 1; i >= 0; i--) {
			const extra = (messages[i] as DatabaseMessage & { extra?: DatabaseMessageExtra[] }).extra;

			if (!extra?.length) continue;

			const images = extra.filter(
				(e): e is DatabaseMessageExtraImageFile => e.type === AttachmentType.IMAGE
			);

			if (images.length > 0) return images.map((img) => img.base64Url);
		}

		return [];
	}
}
