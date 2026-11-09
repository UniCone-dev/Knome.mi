/**
 * Appearance (Settings > Appearance): custom live wallpaper (HTML / CSS / JS / SVG) and custom
 * background image. Everything here is local to this browser.
 */

import { STORAGE_APP_NAME } from './storage.constants';

/** Small preferences (mode, sliders). The big things (image blob, wallpaper code) live in IndexedDB. */
export const APPEARANCE_LOCALSTORAGE_KEY = `${STORAGE_APP_NAME}.appearance`;

export const APPEARANCE_DB_NAME = 'KnomeAppearance';
export const APPEARANCE_DB_STORE = 'kv';
export const APPEARANCE_DB_KEY_IMAGE = 'image';
export const APPEARANCE_DB_KEY_LIVE = 'live';

/** Largest background image accepted (bytes). */
export const APPEARANCE_MAX_IMAGE_BYTES = 40 * 1024 * 1024;

/** Largest total size of the wallpaper code (characters). */
export const APPEARANCE_MAX_CODE_CHARS = 2_000_000;

export type AppearanceMode = 'off' | 'live' | 'image';
export type AppearanceImageFit = 'cover' | 'contain' | 'fill' | 'custom' | 'tile';
export type AppearanceUnit = '%' | 'px' | 'vw' | 'vh';

export interface AppearancePrefs {
	/** Which background is active: nothing (the theme's own), the live wallpaper, or the image. */
	mode: AppearanceMode;
	/** Hide the theme's own animated background (blobs, petals, particles) while a wallpaper is on. */
	hideThemeBackground: boolean;
	/** Overlay in the theme's background colour on top of the wallpaper, 0-90 (%), for readability. */
	dim: number;
	/** Let the live wallpaper code use the network (CDN libraries, fonts, fetch). Off = sealed. */
	liveAllowNetwork: boolean;
	liveOpacity: number;
	liveBlur: number;

	imageFit: AppearanceImageFit;
	imageWidth: number;
	imageWidthUnit: AppearanceUnit;
	/** 0 = auto (keeps the aspect ratio). */
	imageHeight: number;
	imageHeightUnit: AppearanceUnit;
	/** Tile size in px, used by the Tile fit. */
	imageTileSize: number;
	/** Zoom, 50-400 (%). */
	imageScale: number;
	imagePosX: number;
	imagePosY: number;
	imageOpacity: number;
	imageBlur: number;
	imageBrightness: number;
	/** File name of the stored image (display only). */
	imageName: string;
}

export const APPEARANCE_DEFAULTS: AppearancePrefs = {
	dim: 20,
	hideThemeBackground: true,
	imageBlur: 0,
	imageBrightness: 100,
	imageFit: 'cover',
	imageHeight: 0,
	imageHeightUnit: '%',
	imageName: '',
	imageOpacity: 100,
	imagePosX: 50,
	imagePosY: 50,
	imageScale: 100,
	imageTileSize: 320,
	imageWidth: 100,
	imageWidthUnit: '%',
	liveAllowNetwork: false,
	liveBlur: 0,
	liveOpacity: 100,
	mode: 'off'
};

export interface LiveWallpaperCode {
	html: string;
	css: string;
	js: string;
	svg: string;
}

export const EMPTY_LIVE_CODE: LiveWallpaperCode = { css: '', html: '', js: '', svg: '' };

export interface LiveWallpaperExample {
	id: string;
	label: string;
	code: LiveWallpaperCode;
}

export const LIVE_WALLPAPER_EXAMPLES: LiveWallpaperExample[] = [
	{
		id: 'aurora',
		label: 'Aurora (CSS)',
		code: {
			css: `html, body { background: #070b1a; }
.blob {
	position: absolute;
	width: 60vmax;
	height: 60vmax;
	border-radius: 50%;
	filter: blur(80px);
	opacity: 0.55;
	animation: drift 18s ease-in-out infinite alternate;
}
.blob:nth-child(1) { background: #6ee7d8; top: -20%; left: -10%; }
.blob:nth-child(2) { background: #7c5cff; bottom: -25%; right: -10%; animation-duration: 24s; }
.blob:nth-child(3) { background: #ff5ca8; top: 30%; left: 35%; width: 40vmax; height: 40vmax; opacity: 0.35; animation-duration: 30s; }
@keyframes drift {
	to { transform: translate3d(12vw, 8vh, 0) scale(1.15); }
}`,
			html: `<div class="blob"></div>
<div class="blob"></div>
<div class="blob"></div>`,
			js: '',
			svg: ''
		}
	},
	{
		id: 'starfield',
		label: 'Starfield (JS canvas)',
		code: {
			css: `html, body { background: #050814; }
canvas { display: block; width: 100%; height: 100%; }`,
			html: `<canvas id="c"></canvas>`,
			js: `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let w = 0, h = 0, stars = [];

function resize() {
	w = canvas.width = innerWidth;
	h = canvas.height = innerHeight;
	const count = Math.min(600, Math.floor((w * h) / 3500));
	stars = Array.from({ length: count }, () => ({
		x: (Math.random() - 0.5) * w,
		y: (Math.random() - 0.5) * h,
		z: Math.random() * w
	}));
}
addEventListener('resize', resize);
resize();

function frame() {
	ctx.fillStyle = 'rgba(5, 8, 20, 0.35)';
	ctx.fillRect(0, 0, w, h);
	for (const s of stars) {
		s.z -= 1.6;
		if (s.z <= 1) {
			s.x = (Math.random() - 0.5) * w;
			s.y = (Math.random() - 0.5) * h;
			s.z = w;
		}
		const px = (s.x / s.z) * w * 0.6 + w / 2;
		const py = (s.y / s.z) * w * 0.6 + h / 2;
		const r = (1 - s.z / w) * 2.4;
		ctx.fillStyle = 'rgba(200, 220, 255, ' + (0.4 + (1 - s.z / w) * 0.6) + ')';
		ctx.beginPath();
		ctx.arc(px, py, Math.max(r, 0.2), 0, Math.PI * 2);
		ctx.fill();
	}
	requestAnimationFrame(frame);
}
frame();`,
			svg: ''
		}
	},
	{
		id: 'waves',
		label: 'Ocean waves (SVG)',
		code: {
			css: `html, body { background: #0b1020; }
svg { position: absolute; inset: 0; width: 100%; height: 100%; }`,
			html: '',
			js: '',
			svg: `<svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#0b1020" />
			<stop offset="1" stop-color="#16285a" />
		</linearGradient>
	</defs>
	<rect width="1440" height="800" fill="url(#sky)" />
	<path fill="#3b82f6" fill-opacity="0.22" d="M-120 520 C 120 440 360 600 600 520 S 1080 440 1320 520 S 1560 600 1700 520 V800 H-120 Z">
		<animateTransform attributeName="transform" type="translate" values="0 0; -120 16; 0 0" dur="11s" repeatCount="indefinite" />
	</path>
	<path fill="#6ee7d8" fill-opacity="0.16" d="M-120 580 C 140 520 380 660 620 580 S 1100 520 1340 580 S 1580 660 1700 580 V800 H-120 Z">
		<animateTransform attributeName="transform" type="translate" values="-100 0; 20 -14; -100 0" dur="8s" repeatCount="indefinite" />
	</path>
	<path fill="#7c5cff" fill-opacity="0.2" d="M-120 650 C 160 600 400 720 640 650 S 1120 600 1360 650 S 1600 720 1700 650 V800 H-120 Z">
		<animateTransform attributeName="transform" type="translate" values="0 0; -90 10; 0 0" dur="6s" repeatCount="indefinite" />
	</path>
</svg>`
		}
	},
	{
		id: 'matrix',
		label: 'Digital rain (JS canvas)',
		code: {
			css: `html, body { background: #02070a; }
canvas { display: block; width: 100%; height: 100%; }`,
			html: `<canvas id="c"></canvas>`,
			js: `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const glyphs = 'アイウエオカキクケコサシスセソ0123456789ABCDEF';
const size = 16;
let drops = [];

function resize() {
	canvas.width = innerWidth;
	canvas.height = innerHeight;
	drops = Array.from({ length: Math.ceil(innerWidth / size) }, () => Math.random() * -50);
}
addEventListener('resize', resize);
resize();

let last = 0;
function frame(t) {
	if (t - last > 45) {
		last = t;
		ctx.fillStyle = 'rgba(2, 7, 10, 0.14)';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.font = size + 'px monospace';
		for (let i = 0; i < drops.length; i++) {
			const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
			ctx.fillStyle = drops[i] > 0 ? '#5dffa8' : '#0b3d24';
			ctx.fillText(ch, i * size, drops[i] * size);
			if (drops[i] * size > canvas.height && Math.random() > 0.975) drops[i] = 0;
			drops[i] += 1;
		}
	}
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);`,
			svg: ''
		}
	}
];
