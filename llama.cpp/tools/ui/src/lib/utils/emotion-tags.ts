/**
 * Emotion tags: a living character's replies start with `[emo:happy]`. The tag drives the character's
 * video; the reader never sees it.
 */
const COMPLETE_TAG = /\[\s*emo\s*:\s*([a-z0-9-]{1,24})\s*\]\s?/gi;
// a tag still being typed at the very end of streamed text: "[", "[em", "[emo:ha"
const PARTIAL_TAG_AT_END = /\[(?:e(?:m(?:o(?:\s*:\s*[a-z0-9-]*)?)?)?)?\s*$/i;

/** Remove complete tags everywhere and a half-written tag at the end. */
export function stripEmotionTags(text: string): string {
	if (!text || !text.includes('[')) return text;

	return text.replace(COMPLETE_TAG, '').replace(PARTIAL_TAG_AT_END, '');
}

/** Name of the last complete tag in the text, or undefined. */
export function lastEmotionTag(text: string): string | undefined {
	if (!text || !text.includes('[')) return undefined;

	let last: string | undefined;

	for (const m of text.matchAll(COMPLETE_TAG)) last = m[1].toLowerCase();

	return last;
}
