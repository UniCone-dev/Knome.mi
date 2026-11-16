import { describe, expect, it } from 'vitest';
import { clipFromFile, cloneEmotions, emotionHasMedia } from '$lib/utils/emotion-media';

const file = (name: string, type: string, size = 10) =>
	new File([new Uint8Array(size)], name, { type });

describe('emotion media', () => {
	it('accepts mp4, webm, gif, png and rejects the rest', () => {
		expect(clipFromFile(file('a.mp4', 'video/mp4')).clip?.kind).toBe('video');
		expect(clipFromFile(file('a.webm', 'video/webm')).clip?.kind).toBe('video');
		expect(clipFromFile(file('a.gif', 'image/gif')).clip?.kind).toBe('gif');
		expect(clipFromFile(file('a.png', 'image/png')).clip?.kind).toBe('image');
		expect(clipFromFile(file('a.webm', '')).clip?.kind).toBe('video');
		expect(clipFromFile(file('a.pdf', 'application/pdf')).error).toBeTruthy();
		expect(clipFromFile(file('big.mp4', 'video/mp4', 26 * 1024 * 1024)).error).toBeTruthy();
	});

	it('clones emotion sets without touching the blobs', async () => {
		const clip = clipFromFile(file('x.png', 'image/png', 20)).clip!;
		const src = { happy: { loop: clip, holdSeconds: 3 }, empty: {} };
		const copy = cloneEmotions(src);

		expect(copy.happy.loop?.blob).toBe(clip.blob);
		expect(copy.happy.holdSeconds).toBe(3);

		// (export / import to JSON needs FileReader: checked in a real browser)
		expect(emotionHasMedia(copy.happy)).toBe(true);
		expect(emotionHasMedia({})).toBe(false);
	});
});
