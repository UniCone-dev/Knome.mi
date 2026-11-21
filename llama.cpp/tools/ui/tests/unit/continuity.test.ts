import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));
vi.setConfig({ testTimeout: 60000 });

describe('continuity: transcript and chunks', async () => {
	const { buildTranscript, chunkTranscript, sanitize } =
		await import('$lib/stores/continuity.svelte');

	it('keeps user/assistant words, adds notes for pictures and tools, drops the rest', () => {
		const t = buildTranscript([
			{ content: 'sys', role: 'system' },
			{ content: 'Draw a cat', extra: [{ name: 'a.png', type: 'IMAGE' }], role: 'user' },
			{
				content: '<think>x</think>[emo:happy] Sure!',
				role: 'assistant',
				toolCalls: '[{"function":{"name":"web_search"}}]'
			},
			{ content: 'result', role: 'tool' },
			{ content: 'x', isSynthetic: true, role: 'user' }
		]);

		expect(t).toHaveLength(2);
		expect(t[0].text).toContain('Draw a cat');
		expect(t[0].text).toContain('[picture: a.png]');
		expect(t[1].text).toBe('Sure!\n[used tools: web_search]');
	});

	it('leaves out the old auto-summary helper request and its reply', () => {
		const t = buildTranscript([
			{ content: 'hello', role: 'user' },
			{ content: 'hi', role: 'assistant' },
			{
				content: '[System: context is almost full] Please call the save_chat_summary tool now',
				role: 'user'
			},
			{ content: 'saved', role: 'assistant' },
			{ content: 'next question', role: 'user' }
		]);

		expect(t.map((l) => l.text)).toEqual(['hello', 'hi', 'next question']);
	});

	it('chunks so every piece fits, never drops a message', () => {
		const lines = Array.from({ length: 10 }, (_, i) => ({
			role: 'user' as const,
			text: `message ${i} ` + 'x'.repeat(80)
		}));
		const chunks = chunkTranscript(lines, 300);

		expect(chunks.every((c) => c.length <= 300)).toBe(true);
		expect(chunks.join('')).toContain('message 0');
		expect(chunks.join('')).toContain('message 9');
		expect(
			chunkTranscript([{ role: 'user', text: 'y'.repeat(5000) }], 300)[0].length
		).toBeLessThanOrEqual(300);
	});

	it('sanitizes settings', () => {
		expect(sanitize({})).toEqual({
			mode: 'auto',
			recentCount: 4,
			saveSummary: true,
			threshold: 90
		});
		expect(sanitize({ mode: 'weird' as never, recentCount: 99, threshold: 5 })).toMatchObject({
			mode: 'auto',
			recentCount: 10,
			threshold: 50
		});
		expect(sanitize({ mode: 'manual', threshold: 120 }).threshold).toBe(98);
		expect(sanitize({ saveSummary: false }).saveSummary).toBe(false);
	});
});

describe('image: edit detection', async () => {
	const { looksLikeEdit } = await import('$lib/stores/imagegen.svelte');

	it('needs a change word AND a pointer to the earlier picture', () => {
		expect(looksLikeEdit('make it brighter')).toBe(true);
		expect(looksLikeEdit('isko night bana do')).toBe(true);
		expect(looksLikeEdit('add a hat to the same picture')).toBe(true);
		expect(looksLikeEdit('make a picture of a dragon')).toBe(false);
		expect(looksLikeEdit('draw a cat')).toBe(false);
		expect(looksLikeEdit('')).toBe(false);
	});
});
