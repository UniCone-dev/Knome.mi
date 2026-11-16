import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LivingPlayer } from '$lib/stores/living-player.svelte';
import { lastEmotionTag, stripEmotionTags } from '$lib/utils/emotion-tags';
import type { EmotionClip, EmotionSet } from '$lib/types/database';

vi.mock('$app/environment', () => ({ browser: true }));

const clip = (name: string): EmotionClip => ({
	blob: new Blob([name]),
	kind: 'image',
	mime: 'image/png',
	name
});
const full = (n: string, extra: Partial<EmotionSet> = {}): EmotionSet => ({
	start: clip(n + '-start'),
	loop: clip(n + '-loop'),
	end: clip(n + '-end'),
	...extra
});

describe('emotion tags', () => {
	it('hides complete and half written tags, reads the last one', () => {
		expect(stripEmotionTags('[emo:happy] Hello!')).toBe('Hello!');
		expect(stripEmotionTags('Hi [emo:sad]there')).toBe('Hi there');
		expect(stripEmotionTags('[emo:ha')).toBe('');
		expect(stripEmotionTags('[e')).toBe('');
		expect(stripEmotionTags('see [1] and [link](x)')).toBe('see [1] and [link](x)');
		expect(lastEmotionTag('[emo:happy] a [emo:Sad] b')).toBe('sad');
		expect(lastEmotionTag('no tag')).toBeUndefined();
	});
});

describe('LivingPlayer', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const names: string[] = [];
	const watch = (p: LivingPlayer) => {
		const n = p.active?.clip.name ?? 'idle';

		if (names[names.length - 1] !== n) names.push(n);
	};
	const tick = async (ms: number, p: LivingPlayer) => {
		for (let t = 0; t < ms; t += 100) {
			await vi.advanceTimersByTimeAsync(100);
			watch(p);
		}
	};

	it('thinking -> speaking -> feeling -> idle with start / loop / end', async () => {
		names.length = 0;

		const p = new LivingPlayer();

		p.setEmotions({
			thinking: full('think'),
			'happy:speaking': full('hs'),
			happy: full('h', { holdSeconds: 2 })
		});

		p.setTarget({ kind: 'thinking' });
		await tick(2000, p);
		p.setTarget({ kind: 'speaking', emotion: 'happy' });
		await tick(5000, p);
		p.setTarget({ kind: 'feeling', emotion: 'happy' });
		await tick(9000, p);

		expect(names).toEqual([
			'think-start',
			'think-loop',
			'think-end',
			'hs-start',
			'hs-loop',
			'hs-end',
			'h-start',
			'h-loop',
			'h-end',
			'idle'
		]);

		p.destroy();
	});

	it('falls back: unknown emotion -> plain speaking, nothing -> idle', () => {
		const p = new LivingPlayer();

		p.setEmotions({ speaking: full('s') });

		expect(p.resolve({ kind: 'speaking', emotion: 'angry' })?.key).toBe('speaking');
		expect(p.resolve({ kind: 'thinking' })).toBeNull();
		expect(p.resolve({ kind: 'feeling', emotion: 'angry' })).toBeNull();
	});
});
