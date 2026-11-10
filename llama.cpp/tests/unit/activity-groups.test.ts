import { describe, expect, it } from 'vitest';
import { AgenticSectionType as T } from '$lib/enums';
import type { AgenticSection } from '$lib/types/agentic';
import { activityStatus, activitySummary, groupActivity } from '$lib/utils/activity-groups';

const s = (type: T, extra: Partial<AgenticSection> = {}): AgenticSection => ({
	content: 'x',
	type,
	...extra
});

describe('groupActivity', () => {
	it('merges every run of reasoning and tool sections, in order, and leaves text alone', () => {
		// "what is the latest news?": thinks, searches, reads a page, thinks again, answers
		const blocks = groupActivity([
			s(T.REASONING),
			s(T.TOOL_CALL, { toolName: 'web_search' }),
			s(T.TOOL_CALL, { toolName: 'read_webpage' }),
			s(T.REASONING),
			s(T.TEXT, { content: 'Here is the news.' })
		]);

		expect(blocks.map((b) => b.kind)).toEqual(['activity', 'text']);

		const activity = blocks[0];

		expect(activity.kind === 'activity' && activity.items.map((i) => i.index)).toEqual([
			0, 1, 2, 3
		]);
		expect(activity.kind === 'activity' && activity.startIndex).toBe(0);
	});

	it('text between two runs keeps them as two separate blocks', () => {
		const blocks = groupActivity([
			s(T.REASONING),
			s(T.TEXT, { content: 'Let me check.' }),
			s(T.TOOL_CALL)
		]);

		expect(blocks.map((b) => b.kind)).toEqual(['activity', 'text', 'activity']);
	});

	it('an empty text stub does not split a run or count as text having started', () => {
		const blocks = groupActivity([
			s(T.REASONING),
			s(T.TEXT, { content: '  ' }),
			s(T.TOOL_CALL_PENDING)
		]);

		expect(blocks).toHaveLength(1);
		expect(blocks[0].kind).toBe('activity');
	});

	it('is empty for a message with no sections', () => {
		expect(groupActivity([])).toEqual([]);
	});
});

describe('activityStatus (the live label)', () => {
	const items = (...sections: AgenticSection[]) =>
		sections.map((section, index) => ({ index, section }));

	it('says thinking while reasoning', () => {
		expect(activityStatus(items(s(T.REASONING_PENDING)), null)).toBe('thinking');
	});

	it('says tools while a tool call is being written or run', () => {
		expect(activityStatus(items(s(T.REASONING), s(T.TOOL_CALL_STREAMING)), null)).toBe('tools');
		expect(activityStatus(items(s(T.TOOL_CALL_PENDING)), null)).toBe('tools');
		expect(activityStatus(items(s(T.TOOL_CALL, { toolCallId: 'a' })), 'a')).toBe('tools');
	});

	it('goes back to thinking once the tool finished and the model reads its result', () => {
		expect(activityStatus(items(s(T.TOOL_CALL, { toolCallId: 'a' })), 'b')).toBe('thinking');
		expect(activityStatus(items(s(T.TOOL_CALL, { toolCallId: 'a' })), null)).toBe('thinking');
	});
});

describe('activitySummary (the finished label)', () => {
	const items = (...sections: AgenticSection[]) =>
		sections.map((section, index) => ({ index, section }));

	it('describes what happened', () => {
		expect(activitySummary(items(s(T.REASONING)))).toBe('Thought');
		expect(activitySummary(items(s(T.TOOL_CALL)))).toBe('Used 1 tool');
		expect(activitySummary(items(s(T.TOOL_CALL), s(T.TOOL_CALL)))).toBe('Used 2 tools');
		expect(
			activitySummary(items(s(T.REASONING), s(T.TOOL_CALL), s(T.TOOL_CALL), s(T.REASONING)))
		).toBe('Thought and used 2 tools');
	});
});
