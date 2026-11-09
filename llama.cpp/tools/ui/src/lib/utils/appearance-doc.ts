/**
 * Builds the srcdoc of the live wallpaper iframe from the user's HTML / CSS / JS / SVG.
 *
 * The iframe is created with sandbox="allow-scripts" and NO allow-same-origin, so the wallpaper runs
 * in an opaque origin: it cannot read Knome's localStorage, IndexedDB or cookies. On top of that a
 * Content-Security-Policy seals it off from the network unless the user turned that on.
 */

import type { LiveWallpaperCode } from '$lib/constants/appearance.constants';

export const WALLPAPER_MESSAGE_MARKER = '__knomeWallpaper';

const SEALED_CSP =
	"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
	'img-src data: blob:; media-src data: blob:; font-src data:; worker-src blob:; child-src blob:';

const BASE_CSS =
	'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}' +
	'body{position:relative}.knome-svg-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
	'.knome-svg-layer>svg{display:block;width:100%;height:100%}';

/** Reports script errors to the Settings page, so a typo in the code is visible instead of silent. */
function errorHook(channel: string): string {
	const marker = JSON.stringify(WALLPAPER_MESSAGE_MARKER);
	const ch = JSON.stringify(channel);

	return (
		'(function(){function send(m){try{parent.postMessage({' +
		marker +
		':true,channel:' +
		ch +
		',message:String(m)},"*")}catch(e){}}' +
		'addEventListener("error",function(e){send((e.message||"Script error")+(e.lineno?" (line "+e.lineno+")":""))});' +
		'addEventListener("unhandledrejection",function(e){send("Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason))});' +
		'})();'
	);
}

function safeScript(js: string): string {
	return js.replace(/<\/script/gi, '<\\/script');
}

function safeStyle(css: string): string {
	return css.replace(/<\/style/gi, '<\\/style');
}

export function hasWallpaperCode(code: LiveWallpaperCode): boolean {
	return Boolean(code.html.trim() || code.css.trim() || code.js.trim() || code.svg.trim());
}

export function buildLiveWallpaperDoc(
	code: LiveWallpaperCode,
	options: { allowNetwork: boolean; channel: string }
): string {
	const csp = options.allowNetwork
		? ''
		: `<meta http-equiv="Content-Security-Policy" content="${SEALED_CSP}">`;
	const headInject =
		`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${csp}` +
		`<style>${BASE_CSS}</style>`;
	const userStyle = code.css.trim() ? `<style>${safeStyle(code.css)}</style>` : '';
	const svgLayer = code.svg.trim() ? `<div class="knome-svg-layer">${code.svg}</div>` : '';
	const hook = `<script>${errorHook(options.channel)}</script>`;
	const userScript = code.js.trim() ? `<script>${safeScript(code.js)}</script>` : '';

	const html = code.html;
	const isFullDocument = /<!doctype|<html[\s>]/i.test(html);

	if (!isFullDocument) {
		return (
			`<!doctype html><html><head>${headInject}${userStyle}</head>` +
			`<body>${svgLayer}${html}${hook}${userScript}</body></html>`
		);
	}

	// A complete page was pasted: keep it, and slot the extra pieces in around it.
	let doc = html;

	if (/<head[^>]*>/i.test(doc)) {
		doc = doc.replace(/<head[^>]*>/i, (m) => `${m}${hook}${headInject}`);
	} else if (/<html[^>]*>/i.test(doc)) {
		doc = doc.replace(/<html[^>]*>/i, (m) => `${m}<head>${hook}${headInject}</head>`);
	} else {
		doc = `${hook}${headInject}${doc}`;
	}

	if (userStyle) {
		doc = /<\/head>/i.test(doc)
			? doc.replace(/<\/head>/i, () => `${userStyle}</head>`)
			: `${doc}${userStyle}`;
	}

	const tail = `${svgLayer}${userScript}`;

	if (tail) {
		doc = /<\/body>/i.test(doc)
			? doc.replace(/<\/body>/i, () => `${tail}</body>`)
			: `${doc}${tail}`;
	}

	return doc;
}
