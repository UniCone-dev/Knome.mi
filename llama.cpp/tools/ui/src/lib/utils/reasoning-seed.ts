import { MessageRole } from '$lib/enums';

/**
 * Reasoning prefill (immersive mode).
 *
 * Instead of only describing, in the system prompt, how the model should think of itself, hand
 * it the opening words of its OWN reasoning, already written from inside that identity, and let
 * the server continue from there. A trailing assistant message with `reasoning_content` and no
 * content resolves to the server's reasoning-continuation mode (`continue_final_message`).
 * Generation follows the words that came before, so a reasoning block that starts in the
 * character's own first-person voice has no "the user wants me to play X" to get started from.
 *
 * Pure function so the rules can be tested without a server.
 */

export interface SeedableBody {
	messages: { role: string; content: unknown; reasoning_content?: string }[];
	continue_final_message?: boolean;
	add_generation_prompt?: boolean;
}

export interface ReasoningSeedOptions {
	/** opening of the reasoning when the turn follows a user message */
	reasoningSeed?: string;
	/** opening of the reasoning when the turn follows tool results (falls back to reasoningSeed) */
	reasoningSeedAfterTool?: string;
	/** a continuation is already in progress -- never stack a second prefill on it */
	continueFinalMessage?: boolean;
	stream?: boolean;
	disableReasoningParsing?: boolean;
	/** false = the user turned thinking off, so there is no reasoning block to open */
	enableThinking?: boolean;
}

/**
 * Appends the prefill message to `body` when it applies and returns the seed that was used
 * (so the caller can show it as the first piece of the streamed reasoning), else undefined.
 */
export function applyReasoningSeed(
	body: SeedableBody,
	options: ReasoningSeedOptions
): string | undefined {
	if (
		options.continueFinalMessage ||
		!options.stream ||
		options.disableReasoningParsing ||
		options.enableThinking === false
	) {
		return undefined;
	}

	const lastRole = body.messages[body.messages.length - 1]?.role;
	const seed =
		lastRole === MessageRole.USER
			? options.reasoningSeed
			: lastRole === MessageRole.TOOL
				? (options.reasoningSeedAfterTool ?? options.reasoningSeed)
				: undefined;

	if (!seed) return undefined;

	body.messages.push({ content: '', reasoning_content: seed, role: MessageRole.ASSISTANT });
	body.continue_final_message = true;
	body.add_generation_prompt = false;

	return seed;
}
