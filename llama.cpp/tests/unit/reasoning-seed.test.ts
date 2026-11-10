import { describe, expect, it } from 'vitest';
import { applyReasoningSeed, type SeedableBody } from '$lib/utils/reasoning-seed';

const body = (...roles: string[]): SeedableBody => ({
	messages: roles.map((role) => ({ content: `${role} text`, role }))
});
const on = { reasoningSeed: 'I am X. ', reasoningSeedAfterTool: 'After tools. ', stream: true };

describe('applyReasoningSeed', () => {
	it('after a user message: appends a reasoning-only assistant message and continues it', () => {
		const b = body('system', 'user');

		expect(applyReasoningSeed(b, on)).toBe('I am X. ');
		expect(b.messages[b.messages.length - 1]).toEqual({
			content: '',
			reasoning_content: 'I am X. ',
			role: 'assistant'
		});
		expect(b.continue_final_message).toBe(true);
		expect(b.add_generation_prompt).toBe(false);
	});

	it('after tool results: uses the after-tool opening, or falls back to the normal one', () => {
		expect(applyReasoningSeed(body('user', 'assistant', 'tool'), on)).toBe('After tools. ');
		expect(
			applyReasoningSeed(body('user', 'assistant', 'tool'), {
				reasoningSeed: 'Only. ',
				stream: true
			})
		).toBe('Only. ');
	});

	it('never stacks on a continuation that is already in progress', () => {
		const b = body('user', 'assistant');

		expect(applyReasoningSeed(b, { ...on, continueFinalMessage: true })).toBeUndefined();
		expect(b.messages).toHaveLength(2);
	});

	it('does nothing when the last message is not a user or tool message', () => {
		expect(applyReasoningSeed(body('user', 'assistant'), on)).toBeUndefined();
		expect(applyReasoningSeed(body('system'), on)).toBeUndefined();
	});

	it('is skipped when thinking is off, reasoning parsing is off, or the request is not streamed', () => {
		expect(applyReasoningSeed(body('user'), { ...on, enableThinking: false })).toBeUndefined();
		expect(
			applyReasoningSeed(body('user'), { ...on, disableReasoningParsing: true })
		).toBeUndefined();
		expect(applyReasoningSeed(body('user'), { ...on, stream: false })).toBeUndefined();
	});

	it('is skipped without a seed (immersive off)', () => {
		const b = body('user');

		expect(applyReasoningSeed(b, { stream: true })).toBeUndefined();
		expect(b.messages).toHaveLength(1);
		expect(b.continue_final_message).toBeUndefined();
	});
});
