import { AgenticSectionType } from '$lib/enums';
import type { AgenticSection } from '$lib/types/agentic';

/**
 * Groups an assistant message's sections for the "combined" and "typing only" displays: every
 * run of reasoning / tool-call sections (in the order they happened) becomes ONE activity block,
 * the text around it stays as it is. Pure, so the rules can be tested without a browser.
 */

export interface ActivityItem {
	section: AgenticSection;
	/** index in the message's section list (stable key, and what the section renderers expect) */
	index: number;
}

export type ActivityBlock =
	| { kind: 'text'; section: AgenticSection; index: number }
	| { kind: 'activity'; items: ActivityItem[]; startIndex: number };

export function isToolSection(section: AgenticSection): boolean {
	return (
		section.type === AgenticSectionType.TOOL_CALL ||
		section.type === AgenticSectionType.TOOL_CALL_PENDING ||
		section.type === AgenticSectionType.TOOL_CALL_STREAMING
	);
}

export function isReasoningSection(section: AgenticSection): boolean {
	return (
		section.type === AgenticSectionType.REASONING ||
		section.type === AgenticSectionType.REASONING_PENDING
	);
}

export function groupActivity(sections: AgenticSection[]): ActivityBlock[] {
	const blocks: ActivityBlock[] = [];

	sections.forEach((section, index) => {
		if (section.type === AgenticSectionType.TEXT) {
			// an empty text section (e.g. the stub that precedes the first streamed token) must not
			// split a run of activity in two, nor count as "text has started"
			if (!section.content.trim()) return;

			blocks.push({ index, kind: 'text', section });

			return;
		}

		const last = blocks[blocks.length - 1];

		if (last?.kind === 'activity') {
			last.items.push({ index, section });
		} else {
			blocks.push({ items: [{ index, section }], kind: 'activity', startIndex: index });
		}
	});

	return blocks;
}

export type ActivityStatus = 'thinking' | 'tools';

/**
 * What the model is doing right now, for the live label of the block that is still in progress:
 * "tools" while a tool call is being written or run, otherwise "thinking" (that includes the
 * moment after a tool finished, when the model reads its result).
 */
export function activityStatus(
	items: ActivityItem[],
	executingToolCallId: string | null | undefined
): ActivityStatus {
	const last = items[items.length - 1]?.section;

	if (!last) return 'thinking';

	if (last.type === AgenticSectionType.TOOL_CALL_PENDING) return 'tools';
	if (last.type === AgenticSectionType.TOOL_CALL_STREAMING) return 'tools';

	if (
		last.type === AgenticSectionType.TOOL_CALL &&
		last.toolCallId !== undefined &&
		last.toolCallId === executingToolCallId
	) {
		return 'tools';
	}

	return 'thinking';
}

/** Label for a finished block: "Thought", "Used 2 tools", "Thought and used 2 tools". */
export function activitySummary(items: ActivityItem[]): string {
	const tools = items.filter((i) => isToolSection(i.section)).length;
	const thought = items.some((i) => isReasoningSection(i.section));
	const toolText = `${tools} tool${tools === 1 ? '' : 's'}`;

	if (thought && tools > 0) return `Thought and used ${toolText}`;
	if (tools > 0) return `Used ${toolText}`;

	return 'Thought';
}
