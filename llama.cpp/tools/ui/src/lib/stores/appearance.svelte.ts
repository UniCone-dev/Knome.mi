/**
 * appearanceStore - custom background (Settings > Appearance)
 *
 * Two kinds of background can replace the theme's own:
 *  - a live wallpaper written by the user in HTML / CSS / JS / SVG (rendered in a sandboxed iframe)
 *  - a background image uploaded from the user's computer, with size / position / blur controls
 *
 * Small preferences are kept in localStorage (instant on load). The image blob and the wallpaper
 * code live in IndexedDB (own database, see utils/appearance-db.ts), so size is not an issue.
 */

import { browser } from '$app/environment';
import {
	APPEARANCE_DB_KEY_IMAGE,
	APPEARANCE_DB_KEY_LIVE,
	APPEARANCE_DEFAULTS,
	APPEARANCE_LOCALSTORAGE_KEY,
	APPEARANCE_MAX_CODE_CHARS,
	APPEARANCE_MAX_IMAGE_BYTES,
	EMPTY_LIVE_CODE,
	type AppearancePrefs,
	type LiveWallpaperCode
} from '$lib/constants/appearance.constants';
import { appearanceDbDelete, appearanceDbGet, appearanceDbSet } from '$lib/utils/appearance-db';
import { buildLiveWallpaperDoc, hasWallpaperCode } from '$lib/utils/appearance-doc';

function clamp(value: unknown, min: number, max: number, fallback: number): number {
	const n = Number(value);

	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Validate whatever came out of localStorage; unknown or broken values fall back to defaults. */
function sanitizePrefs(raw: Partial<AppearancePrefs> | null | undefined): AppearancePrefs {
	const d = APPEARANCE_DEFAULTS;
	const r = raw ?? {};
	const units = ['%', 'px', 'vw', 'vh'];

	return {
		dim: clamp(r.dim, 0, 90, d.dim),
		hideThemeBackground:
			typeof r.hideThemeBackground === 'boolean' ? r.hideThemeBackground : d.hideThemeBackground,
		imageBlur: clamp(r.imageBlur, 0, 40, d.imageBlur),
		imageBrightness: clamp(r.imageBrightness, 20, 180, d.imageBrightness),
		imageFit: ['cover', 'contain', 'fill', 'custom', 'tile'].includes(r.imageFit as string)
			? (r.imageFit as AppearancePrefs['imageFit'])
			: d.imageFit,
		imageHeight: clamp(r.imageHeight, 0, 5000, d.imageHeight),
		imageHeightUnit: units.includes(r.imageHeightUnit as string)
			? (r.imageHeightUnit as AppearancePrefs['imageHeightUnit'])
			: d.imageHeightUnit,
		imageName: typeof r.imageName === 'string' ? r.imageName : '',
		imageOpacity: clamp(r.imageOpacity, 5, 100, d.imageOpacity),
		imagePosX: clamp(r.imagePosX, 0, 100, d.imagePosX),
		imagePosY: clamp(r.imagePosY, 0, 100, d.imagePosY),
		imageScale: clamp(r.imageScale, 50, 400, d.imageScale),
		imageTileSize: clamp(r.imageTileSize, 40, 2000, d.imageTileSize),
		imageWidth: clamp(r.imageWidth, 1, 5000, d.imageWidth),
		imageWidthUnit: units.includes(r.imageWidthUnit as string)
			? (r.imageWidthUnit as AppearancePrefs['imageWidthUnit'])
			: d.imageWidthUnit,
		liveAllowNetwork: r.liveAllowNetwork === true,
		liveBlur: clamp(r.liveBlur, 0, 40, d.liveBlur),
		liveOpacity: clamp(r.liveOpacity, 5, 100, d.liveOpacity),
		mode: r.mode === 'live' || r.mode === 'image' ? r.mode : 'off'
	};
}

function sanitizeCode(raw: Partial<LiveWallpaperCode> | null | undefined): LiveWallpaperCode {
	const str = (v: unknown) => (typeof v === 'string' ? v : '');

	return { css: str(raw?.css), html: str(raw?.html), js: str(raw?.js), svg: str(raw?.svg) };
}

class AppearanceStore {
	prefs = $state<AppearancePrefs>({ ...APPEARANCE_DEFAULTS });
	live = $state<LiveWallpaperCode>({ ...EMPTY_LIVE_CODE });
	imageUrl = $state('');
	ready = $state(false);
	/** Last script error reported by the wallpaper iframes, by channel ('main' | 'preview'). */
	errors = $state<Record<string, string>>({});

	private started = false;
	private imageObjectUrl = '';

	hasLive = $derived(hasWallpaperCode(this.live));
	hasImage = $derived(Boolean(this.imageUrl));

	/** True when a wallpaper is selected AND there is something to show. */
	active = $derived(
		(this.prefs.mode === 'live' && this.hasLive) || (this.prefs.mode === 'image' && this.hasImage)
	);

	/** srcdoc of the wallpaper that is currently applied. */
	liveDoc = $derived(
		this.hasLive
			? buildLiveWallpaperDoc(this.live, {
					allowNetwork: this.prefs.liveAllowNetwork,
					channel: 'main'
				})
			: ''
	);

	async init(): Promise<void> {
		if (!browser || this.started) return;

		this.started = true;

		try {
			const stored = localStorage.getItem(APPEARANCE_LOCALSTORAGE_KEY);

			if (stored) this.prefs = sanitizePrefs(JSON.parse(stored));
		} catch {
			// unreadable preferences: keep the defaults
		}

		window.addEventListener('message', this.onMessage);

		const [blob, code] = await Promise.all([
			appearanceDbGet<Blob>(APPEARANCE_DB_KEY_IMAGE),
			appearanceDbGet<LiveWallpaperCode>(APPEARANCE_DB_KEY_LIVE)
		]);

		if (blob instanceof Blob) this.setObjectUrl(blob);

		if (code) this.live = sanitizeCode(code);

		this.ready = true;
	}

	private onMessage = (event: MessageEvent) => {
		const data = event.data as { __knomeWallpaper?: boolean; channel?: string; message?: string };

		if (!data || data.__knomeWallpaper !== true || typeof data.channel !== 'string') return;

		this.errors = { ...this.errors, [data.channel]: String(data.message ?? '').slice(0, 400) };
	};

	clearError(channel: string): void {
		if (!(channel in this.errors)) return;

		const next = { ...this.errors };

		delete next[channel];
		this.errors = next;
	}

	private setObjectUrl(blob: Blob): void {
		if (this.imageObjectUrl) URL.revokeObjectURL(this.imageObjectUrl);

		this.imageObjectUrl = URL.createObjectURL(blob);
		this.imageUrl = this.imageObjectUrl;
	}

	private persistPrefs(): void {
		try {
			localStorage.setItem(APPEARANCE_LOCALSTORAGE_KEY, JSON.stringify(this.prefs));
		} catch {
			// storage blocked: the preferences just will not survive a reload
		}
	}

	update(patch: Partial<AppearancePrefs>): void {
		this.prefs = sanitizePrefs({ ...this.prefs, ...patch });
		this.persistPrefs();
	}

	/** Returns an error message, or null when the image was stored and selected. */
	async setImage(file: File): Promise<string | null> {
		if (!file.type.startsWith('image/')) return 'That file is not an image.';

		if (file.size > APPEARANCE_MAX_IMAGE_BYTES) {
			return `Image is too large (max ${Math.round(APPEARANCE_MAX_IMAGE_BYTES / 1024 / 1024)} MB).`;
		}

		const saved = await appearanceDbSet(APPEARANCE_DB_KEY_IMAGE, file);

		if (!saved) return 'Could not store the image in this browser (storage blocked or full).';

		this.setObjectUrl(file);
		this.update({ imageName: file.name, mode: 'image' });

		return null;
	}

	async clearImage(): Promise<void> {
		await appearanceDbDelete(APPEARANCE_DB_KEY_IMAGE);

		if (this.imageObjectUrl) URL.revokeObjectURL(this.imageObjectUrl);

		this.imageObjectUrl = '';
		this.imageUrl = '';
		this.update({ imageName: '', mode: this.prefs.mode === 'image' ? 'off' : this.prefs.mode });
	}

	/** Returns an error message, or null when the wallpaper was saved and selected. */
	async setLive(code: LiveWallpaperCode): Promise<string | null> {
		const clean = sanitizeCode(code);
		const total = clean.html.length + clean.css.length + clean.js.length + clean.svg.length;

		if (!hasWallpaperCode(clean)) return 'Write or load some wallpaper code first.';

		if (total > APPEARANCE_MAX_CODE_CHARS) return 'The wallpaper code is too large.';

		const saved = await appearanceDbSet(APPEARANCE_DB_KEY_LIVE, clean);

		if (!saved) return 'Could not store the wallpaper in this browser (storage blocked or full).';

		this.clearError('main');
		this.live = clean;
		this.update({ mode: 'live' });

		return null;
	}

	async clearLive(): Promise<void> {
		await appearanceDbDelete(APPEARANCE_DB_KEY_LIVE);

		this.live = { ...EMPTY_LIVE_CODE };
		this.clearError('main');
		this.update({ mode: this.prefs.mode === 'live' ? 'off' : this.prefs.mode });
	}

	/** Back to the theme's own background; saved code and image are kept. */
	disable(): void {
		this.update({ mode: 'off' });
	}

	/** Remove everything Appearance stored. */
	async resetAll(): Promise<void> {
		await Promise.all([
			appearanceDbDelete(APPEARANCE_DB_KEY_IMAGE),
			appearanceDbDelete(APPEARANCE_DB_KEY_LIVE)
		]);

		if (this.imageObjectUrl) URL.revokeObjectURL(this.imageObjectUrl);

		this.imageObjectUrl = '';
		this.imageUrl = '';
		this.live = { ...EMPTY_LIVE_CODE };
		this.errors = {};
		this.prefs = { ...APPEARANCE_DEFAULTS };
		this.persistPrefs();
	}

	/** Reset only the image sliders (size, position, blur ...). */
	resetImageAdjustments(): void {
		const d = APPEARANCE_DEFAULTS;

		this.update({
			imageBlur: d.imageBlur,
			imageBrightness: d.imageBrightness,
			imageFit: d.imageFit,
			imageHeight: d.imageHeight,
			imageHeightUnit: d.imageHeightUnit,
			imageOpacity: d.imageOpacity,
			imagePosX: d.imagePosX,
			imagePosY: d.imagePosY,
			imageScale: d.imageScale,
			imageTileSize: d.imageTileSize,
			imageWidth: d.imageWidth,
			imageWidthUnit: d.imageWidthUnit
		});
	}
}

export const appearanceStore = new AppearanceStore();

/** CSS for the background-image element, from the current preferences. */
export function imageLayerStyle(p: AppearancePrefs, url: string): string {
	let size: string;

	switch (p.imageFit) {
		case 'contain':
			size = 'contain';
			break;
		case 'fill':
			size = '100% 100%';
			break;
		case 'custom':
			size = `${p.imageWidth}${p.imageWidthUnit} ${p.imageHeight > 0 ? `${p.imageHeight}${p.imageHeightUnit}` : 'auto'}`;
			break;
		case 'tile':
			size = `${p.imageTileSize}px auto`;
			break;
		default:
			size = 'cover';
	}

	// blur softens the edges of the element, so push them off-screen
	const bleed = p.imageBlur > 0 ? -(p.imageBlur * 2) : 0;
	const filters = [
		p.imageBlur > 0 ? `blur(${p.imageBlur}px)` : '',
		p.imageBrightness !== 100 ? `brightness(${p.imageBrightness}%)` : ''
	]
		.filter(Boolean)
		.join(' ');

	return [
		'position:absolute',
		`inset:${bleed}px`,
		`background-image:url("${url}")`,
		`background-repeat:${p.imageFit === 'tile' ? 'repeat' : 'no-repeat'}`,
		`background-size:${size}`,
		`background-position:${p.imagePosX}% ${p.imagePosY}%`,
		`opacity:${p.imageOpacity / 100}`,
		filters ? `filter:${filters}` : '',
		p.imageScale !== 100 ? `transform:scale(${p.imageScale / 100})` : '',
		`transform-origin:${p.imagePosX}% ${p.imagePosY}%`
	]
		.filter(Boolean)
		.join(';');
}
