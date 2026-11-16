/**
 * Helpers for living-character emotion media (mp4 / webm video, GIF, PNG / JPEG / WebP pictures).
 */
import { EMOTION_MAX_CLIP_BYTES } from '$lib/constants';
import type { EmotionClip, EmotionSet } from '$lib/types/database';

const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/apng'];

/** Turn a picked file into a clip, or an error text the UI can show. */
export function clipFromFile(file: File): { clip?: EmotionClip; error?: string } {
	if (file.size > EMOTION_MAX_CLIP_BYTES) {
		return { error: `${file.name} is too big (max ${EMOTION_MAX_CLIP_BYTES / 1048576} MB)` };
	}

	const type = file.type || guessMime(file.name);
	let kind: EmotionClip['kind'];

	if (VIDEO_TYPES.includes(type)) kind = 'video';
	else if (type === 'image/gif') kind = 'gif';
	else if (IMAGE_TYPES.includes(type)) kind = 'image';
	else return { error: `${file.name}: use mp4, webm, gif, png, jpg or webp` };

	return { clip: { blob: file, kind, mime: type, name: file.name } };
}

function guessMime(name: string): string {
	const ext = name.split('.').pop()?.toLowerCase() ?? '';

	return (
		{
			mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg',
			jpeg: 'image/jpeg', webp: 'image/webp', apng: 'image/apng'
		}[ext] ?? ''
	);
}

/** Plain copy of an emotions map (so IndexedDB never sees a reactive proxy). Blobs are kept as they are. */
export function cloneEmotions(src?: Record<string, EmotionSet>): Record<string, EmotionSet> {
	const out: Record<string, EmotionSet> = {};

	for (const [key, set] of Object.entries(src ?? {})) {
		const copy: EmotionSet = {};

		for (const slot of ['start', 'loop', 'end'] as const) {
			const c = set[slot];

			if (c) copy[slot] = { blob: c.blob, kind: c.kind, mime: c.mime, name: c.name };
		}

		if (set.holdSeconds !== undefined) copy.holdSeconds = set.holdSeconds;
		if (set.stepSeconds !== undefined) copy.stepSeconds = set.stepSeconds;

		out[key] = copy;
	}

	return out;
}

export function emotionHasMedia(set?: EmotionSet): boolean {
	return Boolean(set && (set.start || set.loop || set.end));
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();

		r.onload = () => resolve(String(r.result));
		r.onerror = () => reject(r.error);
		r.readAsDataURL(blob);
	});
}

async function dataUrlToBlob(url: string): Promise<Blob> {
	return (await fetch(url)).blob();
}

/** The JSON form used inside an exported character card. */
export type ExportedEmotions = Record<
	string,
	{
		start?: { data: string; kind: EmotionClip['kind']; mime: string; name?: string };
		loop?: { data: string; kind: EmotionClip['kind']; mime: string; name?: string };
		end?: { data: string; kind: EmotionClip['kind']; mime: string; name?: string };
		holdSeconds?: number;
		stepSeconds?: number;
	}
>;

export async function emotionsToExport(src?: Record<string, EmotionSet>): Promise<ExportedEmotions> {
	const out: ExportedEmotions = {};

	for (const [key, set] of Object.entries(src ?? {})) {
		const item: ExportedEmotions[string] = {};

		for (const slot of ['start', 'loop', 'end'] as const) {
			const c = set[slot];

			if (c) item[slot] = { data: await blobToDataUrl(c.blob), kind: c.kind, mime: c.mime, name: c.name };
		}

		if (set.holdSeconds !== undefined) item.holdSeconds = set.holdSeconds;
		if (set.stepSeconds !== undefined) item.stepSeconds = set.stepSeconds;

		out[key] = item;
	}

	return out;
}

export async function emotionsFromExport(data: unknown): Promise<Record<string, EmotionSet>> {
	const out: Record<string, EmotionSet> = {};

	if (!data || typeof data !== 'object') return out;

	for (const [key, raw] of Object.entries(data as ExportedEmotions)) {
		if (!raw || typeof raw !== 'object') continue;

		const set: EmotionSet = {};

		for (const slot of ['start', 'loop', 'end'] as const) {
			const c = raw[slot];

			if (c && typeof c.data === 'string' && c.data.startsWith('data:')) {
				set[slot] = { blob: await dataUrlToBlob(c.data), kind: c.kind, mime: c.mime, name: c.name };
			}
		}

		if (typeof raw.holdSeconds === 'number') set.holdSeconds = raw.holdSeconds;
		if (typeof raw.stepSeconds === 'number') set.stepSeconds = raw.stepSeconds;

		if (emotionHasMedia(set)) out[key] = set;
	}

	return out;
}

/** Object URLs for blobs, created once per blob and released together. */
export class BlobUrls {
	private map = new WeakMap<Blob, string>();
	private all = new Set<string>();

	get(blob: Blob): string {
		let url = this.map.get(blob);

		if (!url) {
			url = URL.createObjectURL(blob);
			this.map.set(blob, url);
			this.all.add(url);
		}

		return url;
	}

	revokeAll(): void {
		for (const u of this.all) URL.revokeObjectURL(u);

		this.all.clear();
		this.map = new WeakMap();
	}
}
