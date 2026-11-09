import { BuiltInTool } from '$lib/enums';
import { JsonSchemaType, ToolCallType } from '$lib/enums';
import type { OpenAIToolDefinition } from '$lib/types';

export const DESCRIBE_IMAGE_TOOL_NAME = BuiltInTool.BROWSER_DESCRIBE_IMAGE;

/**
 * Build the describe_image ("Vision Bridge") tool definition. Only offered
 * when the active model has no vision of its own but another model loaded
 * on this router does -- see toolsStore.visionBridgeTool().
 */
export function buildDescribeImageToolDefinition(visionModelLabel: string): OpenAIToolDefinition {
	return {
		function: {
			description:
				`You cannot see images yourself, but "${visionModelLabel}" (a vision model loaded ` +
				'on this same server) can. Call this whenever the user attaches or references an ' +
				'image and understanding it would help -- this asks that model to look at the most ' +
				'recently attached image(s) and describe what it sees. Optionally ask it something ' +
				'specific (e.g. "what breed of dog is this?", "read the text in this image") instead ' +
				'of a generic description.',
			name: DESCRIBE_IMAGE_TOOL_NAME,
			parameters: {
				properties: {
					question: {
						description:
							'Optional: a specific question about the image, instead of a generic description.',
						type: JsonSchemaType.STRING
					}
				},
				required: [],
				type: JsonSchemaType.OBJECT
			}
		},
		type: ToolCallType.FUNCTION
	};
}
