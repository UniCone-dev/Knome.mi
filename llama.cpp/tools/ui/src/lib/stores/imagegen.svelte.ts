/**
 * imageGenStore - "Create image" / "Create video" with a smart model swap.
 *
 * Images are made by a separate program, the stable-diffusion.cpp `sd-server`. It cannot share the
 * GPU/RAM with a big text model, so when "Smart workload" is on, every generation does:
 *
 *   1. remember which text model(s) are loaded
 *   2. unload them                       (llama-server router: POST /models/unload)
 *   3. load the diffusion model + parts  (sd-server: POST /sdcpp/v1/models/load, recipe + files)
 *   4. generate                          (sd-server: POST /sdcpp/v1/img_gen | vid_gen, then poll the job)
 *   5. unload the diffusion model        (sd-server: POST /sdcpp/v1/models/unload)
 *   6. load the remembered text model(s) again               <- ALWAYS runs, even after an error
 *   7. put the picture into the chat
 *
 * The text AI writes the detailed prompt itself: while the feature is on it is told to answer with a
 * short line plus <image_prompt>...</image_prompt>. That tag is detected after the reply is finished
 * (see chatStore), removed from the message, and the swap above starts.
 *
 * Off by default. Settings live in localStorage ('Knome.imagegen'), per browser.
 */
import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';
import { ModelsService } from '$lib/services/models.service';
import { AttachmentType } from '$lib/enums';
import { DatabaseService } from '$lib/services/database.service';
import { conversationsStore } from './conversations/index.svelte';
import { modelsStore } from './models/index.svelte';
import { serverStore } from './server.svelte';
import { mmprojStore } from './mmproj.svelte';
import type { ApiModelDataEntry } from '$lib/types/api';

const KEY = 'Knome.imagegen';

export type GenKind = 'image' | 'video';
export type GenPhase =
	| 'idle'
	| 'prompting'
	| 'unloading-text'
	| 'loading-diffusion'
	| 'generating'
	| 'unloading-diffusion'
	| 'restoring-text'
	| 'done'
	| 'error';

export interface ImageGenConfig {
	/** master switch. Off until the image server is found (then it turns on by itself) or you switch it */
	enabled: boolean;
	/** true once the user flipped the switch themselves: the app never changes it again */
	touched: boolean;
	/** per type switches */
	image: boolean;
	video: boolean;
	/** let the text AI start a generation on its own when you ask for a picture in normal chat */
	aiCanStart: boolean;
	/** add a short "image ready" note under the picture */
	announce: boolean;
	sdUrl: string;
	/** recipe id and chosen file per slot, for image and for video */
	imageRecipe: string;
	imageModels: Record<string, string>;
	videoRecipe: string;
	videoModels: Record<string, string>;
	width: number;
	height: number;
	/** 0 = recipe default */
	steps: number;
	/** 0 = model default */
	cfg: number;
	negative: string;
	videoFrames: number;
	videoFps: number;
	videoFormat: 'webm' | 'webp' | 'avi';
}

const DEFAULTS: ImageGenConfig = {
	enabled: false,
	touched: false,
	image: true,
	video: false,
	aiCanStart: true,
	announce: true,
	sdUrl: 'http://127.0.0.1:1234',
	imageRecipe: '',
	imageModels: {},
	videoRecipe: '',
	videoModels: {},
	width: 1024,
	height: 1024,
	steps: 0,
	cfg: 0,
	negative: '',
	videoFrames: 33,
	videoFps: 16,
	videoFormat: 'webm'
};

export interface SdRecipe {
	id: string;
	name?: string;
	description?: string;
	slots: { id: string; required: boolean; label?: string }[];
	required_any?: string[][];
	defaults?: Record<string, unknown>;
	features?: string[];
}

export interface SdFile {
	id: string;
	name: string;
	category: string;
}

/** which model-files category each recipe slot reads from (from the sd-server api docs) */
export const SLOT_CATEGORIES: Record<string, string[]> = {
	model: ['checkpoints'],
	diffusion_model: ['diffusion_models'],
	high_noise_diffusion_model: ['diffusion_models'],
	uncond_diffusion_model: ['diffusion_models'],
	clip_l: ['text_encoders'],
	clip_g: ['text_encoders'],
	t5xxl: ['text_encoders'],
	llm: ['text_encoders'],
	audio_encoder: ['text_encoders'],
	embeddings_connectors: ['text_encoders'],
	clip_vision: ['clip_vision'],
	llm_vision: ['text_encoders', 'clip_vision'],
	vae: ['vae'],
	audio_vae: ['vae'],
	tae: ['vae', 'vae_approx'],
	taesd: ['vae', 'vae_approx'],
	tokenizer: ['tokenizers'],
	control_net: ['controlnet'],
	ip_adapter: ['ipadapter'],
	motion_module: ['motion_modules'],
	photo_maker: ['photomaker'],
	pulid_weights: ['pulid']
};

const TAG_RE = /<(image|video)_prompt([^>]*)>([\s\S]*?)<\/\1_prompt>/i;
const OPEN_TAG_RE = /<(image|video)_prompt[^>]*>?[\s\S]*$/i;

/** what the text AI may choose per request (attributes of the tag) */
export interface GenOptions {
	width?: number;
	height?: number;
	steps?: number;
	cfg?: number;
	seed?: number;
	sampler?: string;
	negative?: string;
	strength?: number;
	frames?: number;
	fps?: number;
	/** pictures to edit / use as reference (data URLs) */
	images?: string[];
}

function parseAttrs(raw: string): GenOptions {
	const a: Record<string, string> = {};

	for (const m of raw.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) a[m[1].toLowerCase()] = m[2];

	const num = (v?: string) => {
		const n = Number(v);

		return v !== undefined && v !== '' && Number.isFinite(n) ? n : undefined;
	};
	const o: GenOptions = {};
	const size = (a.size ?? '').match(/^(\d{3,4})\s*[x×]\s*(\d{3,4})$/i);

	if (size) {
		o.width = +size[1];
		o.height = +size[2];
	}

	const clamp64 = (n?: number) =>
		n === undefined ? undefined : Math.min(2048, Math.max(256, Math.round(n / 64) * 64));

	o.width = clamp64(o.width ?? num(a.width));
	o.height = clamp64(o.height ?? num(a.height));
	o.steps = num(a.steps);
	o.cfg = num(a.cfg);
	o.seed = num(a.seed);
	o.sampler = SAMPLERS.includes((a.sampler ?? '').toLowerCase())
		? a.sampler.toLowerCase()
		: undefined;
	o.negative = a.negative || undefined;
	o.strength = num(a.strength);
	o.frames = num(a.frames);
	o.fps = num(a.fps);

	return o;
}

const SAMPLERS = [
	'euler',
	'euler_a',
	'heun',
	'dpm2',
	'dpm++2s_a',
	'dpm++2m',
	'dpm++2mv2',
	'ipndm',
	'ipndm_v',
	'lcm',
	'ddim_trailing',
	'tcd'
];

/** what a model family renders well: native size and the biggest size worth asking for */
export interface SizeLimits {
	/** biggest side in pixels */
	maxSide: number;
	/** biggest picture area in pixels */
	maxPixels: number;
	/** the area it was trained on (square side) */
	native: number;
}

export function limitsFor(recipe?: { id: string; name?: string }): SizeLimits {
	const n = `${recipe?.id ?? ''} ${recipe?.name ?? ''}`.toLowerCase();

	if (/sd[-_ ]?1|sd15|v1[-_.]5|sd[-_ ]?2|sd[-_ ]?turbo|sdturbo|lcm/.test(n) && !/sdxl|xl/.test(n))
		return { maxSide: 1024, maxPixels: 768 * 768, native: 512 };

	if (/sdxl|sd[-_ ]?xl|xl|pony|illustrious|sd3|sd[-_ ]?3/.test(n))
		return { maxSide: 1536, maxPixels: 1536 * 1024, native: 1024 };

	if (/wan|video|ltx|hunyuan|cogvideo/.test(n))
		return { maxSide: 1280, maxPixels: 1280 * 720, native: 768 };

	// flux, qwen-image, z-image, chroma, ovis ...: trained around 1 MP, fine up to ~2K
	return { maxSide: 2048, maxPixels: 2048 * 1152, native: 1024 };
}

/** scale (w,h) down to the model limits, keep the ratio, round to multiples of 64 */
export function fitSize(w: number, h: number, lim: SizeLimits): { width: number; height: number } {
	let f = 1;

	f = Math.min(f, lim.maxSide / Math.max(w, h));
	f = Math.min(f, Math.sqrt(lim.maxPixels / (w * h)));

	const r = (n: number) => Math.min(2048, Math.max(256, Math.round((n * f) / 64) * 64));

	return { width: r(w), height: r(h) };
}

export const ASPECTS: Record<string, [number, number]> = {
	'1:1': [1, 1],
	'16:9': [16, 9],
	'9:16': [9, 16],
	'4:3': [4, 3],
	'3:4': [3, 4],
	'3:2': [3, 2],
	'2:3': [2, 3],
	'21:9': [21, 9]
};

export type Resolution = 'auto' | 'standard' | 'high' | 'max';
export type Quality = 'auto' | 'draft' | 'normal' | 'high';

/** choices the user can make in the composer; "auto" = the AI decides */
export interface ManualChoice {
	aspect: string;
	resolution: Resolution;
	quality: Quality;
	steps: number;
}

const AUTO: ManualChoice = { aspect: 'auto', resolution: 'auto', quality: 'auto', steps: 0 };

function read(): ImageGenConfig {
	if (!browser) return { ...DEFAULTS };

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');

		return { ...DEFAULTS, ...(v && typeof v === 'object' ? v : {}) };
	} catch {
		return { ...DEFAULTS };
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class ImageGenStore {
	config = $state<ImageGenConfig>(read());
	/** "Create image / video" chosen in the + menu: the next message becomes a generation request */
	armed = $state<GenKind | null>(null);
	manual = $state<ManualChoice>({ aspect: 'auto', resolution: 'auto', quality: 'auto', steps: 0 });
	phase = $state<GenPhase>('idle');
	kind = $state<GenKind>('image');
	detail = $state('');
	startedAt = $state(0);
	/** catalog fetched from sd-server (settings screen) */
	recipes = $state<SdRecipe[]>([]);
	files = $state<SdFile[]>([]);
	catalogError = $state('');
	catalogLoading = $state(false);
	/** the image server answered (sd-server is running) */
	reachable = $state(false);
	private initStarted = false;

	private manualOn = false;
	private cancelled = false;
	private jobId = '';

	get busy(): boolean {
		return this.phase !== 'idle' && this.phase !== 'done' && this.phase !== 'error';
	}

	get imageReady(): boolean {
		return this.config.enabled && this.config.image;
	}

	get videoReady(): boolean {
		return this.config.enabled && this.config.video;
	}

	update(patch: Partial<ImageGenConfig>, auto = false): void {
		if ('enabled' in patch && !auto) patch = { ...patch, touched: true };

		this.config = { ...this.config, ...patch };

		if (this.armed === 'image' && !this.imageReady) this.armed = null;

		if (this.armed === 'video' && !this.videoReady) this.armed = null;

		if (!browser) return;

		try {
			localStorage.setItem(KEY, JSON.stringify(this.config));
		} catch {
			/* storage unavailable */
		}
	}

	arm(kind: GenKind): void {
		this.armed = kind;
	}

	disarm(): void {
		this.armed = null;
	}

	/** Extra instructions for the text AI, merged into each request (not stored). */
	buildPromptBlock(): string {
		const c = this.config;

		if (!c.enabled) return '';

		const kinds: GenKind[] = [];

		if (c.image) kinds.push('image');

		if (c.video) kinds.push('video');

		if (!kinds.length) return '';

		const lines: string[] = [];
		const k = this.armed ?? kinds[0];

		if (this.armed) {
			lines.push(
				`The user chose "Create ${this.armed}" - their next message is a request to make a ${this.armed}.`,
				`Reply with ONE short friendly line, then the generation tag described below.`
			);
		} else if (c.aiCanStart) {
			lines.push(
				`You can make ${kinds.join(' and ')}s through a separate generator. Only when the user clearly asks you to create, draw, generate or EDIT one (also when they attach a picture and ask for a change): reply with ONE short friendly line, then the tag below.`
			);
		} else {
			return '';
		}

		const rid = k === 'image' ? c.imageRecipe : c.videoRecipe;
		const rec = this.recipes.find((r) => r.id === rid);
		const lim = limitsFor(rec);
		const d = (rec?.defaults ?? {}) as Record<string, unknown>;

		lines.push(
			`Tag: <${k}_prompt size="WIDTHxHEIGHT">detailed English prompt</${k}_prompt>`,
			'Optional extra attributes inside the tag, each only when the user asked for it: steps, cfg, seed (a number), sampler, negative, strength. Never write placeholders such as N or X - leave an attribute out instead. Never invent values.',
			`Current defaults: size ${c.width}x${c.height}${c.steps ? `, steps ${c.steps}` : ''}${rec ? `; model "${rec.name ?? rec.id}"${d.steps ? ` (its own default: ${d.steps} steps, cfg ${d.cfg_scale ?? '?'}, sampler ${d.sampling_method ?? '?'})` : ''}` : ''}.`,
			`This model renders well up to ${lim.maxSide}px on the long side (about ${(lim.maxPixels / 1e6).toFixed(1)} megapixels, native ${lim.native}x${lim.native}). Pick the size yourself inside that limit: when the user wants "2K"/"high resolution"/"wallpaper", use the largest size of the wanted aspect ratio the model supports; bigger sizes are scaled down automatically. size = multiples of 64.`,
			'Aspect ratios (examples at ~1 MP): 1:1 1024x1024, 16:9 1344x768, 9:16 768x1344, 4:3 1152x864, 3:4 864x1152, 3:2 1216x832, 2:3 832x1216, 21:9 1536x640. "wallpaper"/"landscape" = 16:9, "phone"/"story" = 9:16, "poster"/"portrait" = 2:3.',
			'steps = quality/speed: draft 8-12, normal 20-28, high 30-40, max 50. For turbo/distilled/lightning models keep very few steps (4-12) or omit it. "Better quality" = a few more steps and a more detailed prompt.',
			'cfg = how strictly to follow the prompt (normal 4-7; distilled/turbo models use about 1 - omit it unless asked). sampler e.g. euler, euler_a, dpm++2m. seed fixes the result ("same picture again" = reuse the seed).',
			'negative = things to avoid (for models that support it). strength 0-1 only when editing a picture: low = small change, high = big change.',
			'There is NO image tool or function. Never call a tool/function for pictures (no generate_image); just write the tag, the app does the rest.',
			'The prompt must be English, one detailed paragraph: subject, setting, style, lighting, colours, composition, camera/lens, mood, quality words. No lists, no commentary inside the tag.',
			'If the user attached picture(s), they are sent to the generator automatically: write the prompt as the wanted CHANGE or the full wanted result, and keep their subject.',
			'Never say the picture is finished yourself - the app shows it automatically.'
		);

		const m = this.manual;
		const fixed: string[] = [];

		if (this.armed && m.aspect !== 'auto') fixed.push(`aspect ratio ${m.aspect}`);

		if (this.armed && m.resolution !== 'auto') fixed.push(`resolution "${m.resolution}"`);

		if (this.armed && (m.quality !== 'auto' || m.steps > 0)) fixed.push('quality/steps');

		if (fixed.length)
			lines.push(
				`The user already fixed ${fixed.join(', ')} in the app. Do not write size or steps for those - the app applies them. Only write the prompt (and other attributes the user asked for).`
			);

		return lines.join('\n');
	}

	/** user's composer choices win over the AI's; the model's size limits always apply */
	applyLimits(kind: GenKind, o: GenOptions): GenOptions {
		const c = this.config;
		const rec = this.recipes.find(
			(r) => r.id === (kind === 'image' ? c.imageRecipe : c.videoRecipe)
		);
		const lim = limitsFor(rec);
		const m = this.manualOn ? this.manual : AUTO;
		const out: GenOptions = { ...o };
		const d = (rec?.defaults ?? {}) as Record<string, unknown>;

		if (
			kind === 'image' &&
			(m.aspect !== 'auto' || m.resolution !== 'auto' || o.width || o.height)
		) {
			const aiW = o.width ?? c.width;
			const aiH = o.height ?? c.height;
			const [ar, br] = m.aspect !== 'auto' && ASPECTS[m.aspect] ? ASPECTS[m.aspect] : [aiW, aiH];
			const ratio = ar / br;
			const aiPx = (o.width ?? 0) * (o.height ?? 0);
			const px =
				m.resolution === 'standard'
					? lim.native * lim.native
					: m.resolution === 'high'
						? Math.min(lim.maxPixels, lim.native * lim.native * 2.25)
						: m.resolution === 'max'
							? lim.maxPixels
							: aiPx || c.width * c.height;
			const h = Math.sqrt(px / ratio);

			Object.assign(out, fitSize(h * ratio, h, lim));
		}

		const base = Number(d.steps) > 0 ? Number(d.steps) : 0;
		const fast = base > 0 && base <= 12;

		if (m.steps > 0) out.steps = m.steps;
		else if (m.quality !== 'auto') {
			const table = fast
				? { draft: base, normal: base, high: Math.round(base * 1.5) }
				: { draft: 12, normal: 24, high: 40 };

			out.steps = table[m.quality];
		}

		return out;
	}

	/** Remove the tag (also a half-written one while streaming) so the user sees clean text. */
	stripTag(text: string): string {
		return text.replace(TAG_RE, '').replace(OPEN_TAG_RE, '').trim();
	}

	// ---------------------------------------------------------------- sd-server

	private url(path: string): string {
		return this.config.sdUrl.replace(/\/+$/, '') + path;
	}

	private async sd<T = unknown>(path: string, init?: RequestInit): Promise<T> {
		let res: Response;

		try {
			res = await fetch(this.url(path), {
				...init,
				headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
			});
		} catch {
			throw new Error(
				`Cannot reach the image server at ${this.config.sdUrl}. It may have just stopped (often low memory) - Knome restarts it by itself, wait a few seconds and try again. Details: image-server.log`
			);
		}

		const text = await res.text();
		let data: unknown = null;

		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			/* not json */
		}

		if (!res.ok) {
			const msg =
				(data as { error?: string } | null)?.error ?? (text.slice(0, 200) || `HTTP ${res.status}`);

			throw new Error(`Image server: ${msg}`);
		}

		return data as T;
	}

	async loadCatalog(): Promise<void> {
		this.catalogLoading = true;
		this.catalogError = '';

		try {
			// pick up files added since the server started
			await this.sd('/sdcpp/v1/models/refresh', { method: 'POST', body: '{}' }).catch(
				() => undefined
			);

			const [r, f] = await Promise.all([
				this.sd<{ recipes: SdRecipe[] }>('/sdcpp/v1/recipes'),
				this.sd<{ files: SdFile[] }>('/sdcpp/v1/model-files')
			]);

			this.recipes = r.recipes ?? [];
			this.files = f.files ?? [];
		} catch (e) {
			this.catalogError = e instanceof Error ? e.message : String(e);
		} finally {
			this.catalogLoading = false;
		}
	}

	filesForSlot(slot: string): SdFile[] {
		const cats = SLOT_CATEGORIES[slot] ?? [];

		return this.files.filter((f) => cats.includes(f.category));
	}

	private norm(x: string): string {
		return x.toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	/** best file for one slot: names that look like the slot / model win over the first in the list */
	private pickFile(slot: string, recipeId: string, mainFile?: string): SdFile | undefined {
		const opts = this.filesForSlot(slot);
		const rid = this.norm(recipeId);
		const score = (f: SdFile): number => {
			const n = this.norm(f.name);
			let sc = 0;

			if (slot === 'llm_vision') sc += n.includes('mmproj') ? 10 : -10;
			else if (n.includes('mmproj')) sc -= 10;

			if (slot === 'llm') sc += /qwen|gemma|llama|mistral|llm/.test(n) ? 5 : 0;

			if (slot === 'vae') sc += /^ae|vae/.test(n) ? 5 : 0;

			if (slot === 'clip_l') sc += /clipl|clip_l/.test(n) ? 5 : 0;

			if (slot === 'clip_g') sc += /clipg/.test(n) ? 5 : 0;

			if (slot === 't5xxl') sc += /t5/.test(n) ? 5 : 0;

			if (mainFile && f.id === mainFile) sc += 3;

			if (slot === 'diffusion_model' || slot === 'model') sc += n.includes(rid) ? 8 : 0;

			return sc;
		};

		return [...opts].sort((x, y) => score(y) - score(x))[0];
	}

	/** fill every required slot (and a VAE when the recipe needs one) that is still empty */
	autoFill(kind: GenKind): void {
		const id = kind === 'image' ? this.config.imageRecipe : this.config.videoRecipe;
		const recipe = this.recipes.find((r) => r.id === id);

		if (!recipe) return;

		const cur = { ...(kind === 'image' ? this.config.imageModels : this.config.videoModels) };
		const needsOne = (recipe.required_any ?? []).flat();

		for (const s of recipe.slots) {
			if (cur[s.id]) continue;

			const want =
				s.required ||
				(needsOne.includes(s.id) && s.id === 'vae') ||
				(s.id === 'llm_vision' && cur.llm?.toLowerCase().endsWith('.gguf'));
			const f = want ? this.pickFile(s.id, recipe.id) : undefined;

			if (f) cur[s.id] = f.id;
		}

		this.update(kind === 'image' ? { imageModels: cur } : { videoModels: cur });
	}

	/** Called once when the app opens: finds the image server, switches the feature on, picks models. */
	async init(): Promise<void> {
		if (this.initStarted || !browser) return;

		this.initStarted = true;

		try {
			await this.sd('/sdcpp/v1/model-files');
			this.reachable = true;
		} catch {
			this.reachable = false;

			return;
		}

		if (!this.config.touched && !this.config.enabled) this.update({ enabled: true }, true);

		if (this.config.enabled) await this.autoDetect();
	}

	/** forget saved choices whose files / model type no longer exist */
	private prune(): void {
		const known = new Set(this.files.map((f) => f.id));
		const patch: Partial<ImageGenConfig> = {};

		for (const kind of ['image', 'video'] as GenKind[]) {
			const rKey = kind === 'image' ? 'imageRecipe' : 'videoRecipe';
			const mKey = kind === 'image' ? 'imageModels' : 'videoModels';
			const rid = this.config[rKey];

			if (rid && !this.recipes.some((r) => r.id === rid)) {
				patch[rKey] = '';
				patch[mKey] = {};
				continue;
			}

			const kept = Object.fromEntries(
				Object.entries(this.config[mKey]).filter(([, v]) => known.has(v))
			);

			if (Object.keys(kept).length !== Object.keys(this.config[mKey]).length) patch[mKey] = kept;
		}

		if (Object.keys(patch).length) this.update(patch);
	}

	/** Look at the files, choose the model type that matches them and fill all its parts. */
	async autoDetect(): Promise<void> {
		await this.loadCatalog();

		if (this.catalogError) {
			this.reachable = false;

			return;
		}

		this.reachable = true;
		this.prune();

		const mains = this.files.filter(
			(f) => f.category === 'diffusion_models' || f.category === 'checkpoints'
		);
		const isVid = (r: SdRecipe) => /wan|ltx|hunyuan|video|svd|cogvideo|mochi/i.test(r.id);

		for (const kind of ['image', 'video'] as GenKind[]) {
			const cur = kind === 'image' ? this.config.imageRecipe : this.config.videoRecipe;

			if (cur) {
				this.autoFill(kind);
				continue;
			}

			let best: { r: SdRecipe; f: SdFile; score: number } | null = null;

			for (const r of this.recipes) {
				if (isVid(r) !== (kind === 'video')) continue;

				const rid = this.norm(r.id);

				for (const f of mains) {
					if (this.norm(f.name).includes(rid) && (!best || rid.length > best.score)) {
						best = { r, f, score: rid.length };
					}
				}
			}

			if (!best) continue;

			const slot = best.r.slots.find((x) => x.id === 'diffusion_model' || x.id === 'model');

			this.update(
				kind === 'image'
					? { imageRecipe: best.r.id, imageModels: slot ? { [slot.id]: best.f.id } : {} }
					: { videoRecipe: best.r.id, videoModels: slot ? { [slot.id]: best.f.id } : {} }
			);
			this.autoFill(kind);
		}
	}

	// ---------------------------------------------------------------- text models

	private async waitRouter(
		predicate: (m: { id: string; status: string }) => boolean,
		timeoutMs: number
	): Promise<void> {
		const t0 = Date.now();

		while (Date.now() - t0 < timeoutMs) {
			const list = await ModelsService.listRouter();
			const rows = (list.data ?? []).map((m: ApiModelDataEntry) => ({
				id: m.id,
				status: String(m.status?.value ?? '')
			}));

			if (rows.every((r: { id: string; status: string }) => predicate(r))) return;

			await sleep(700);
		}

		throw new Error('A text model took too long to change state.');
	}

	private async unloadTextModels(ids: string[]): Promise<void> {
		for (const id of ids) {
			await ModelsService.unload(id).catch(() => undefined);
		}

		// wait until nothing is loaded/loading any more
		await this.waitRouter(
			(m) => m.status !== 'loaded' && m.status !== 'loading' && m.status !== 'sleeping',
			120_000
		);

		// let the OS take the memory back before the big image model is read in
		await sleep(2500);
	}

	private async restoreTextModels(ids: string[]): Promise<void> {
		for (const id of ids) {
			await ModelsService.load(id, undefined, mmprojStore.get(id) || undefined);
		}

		const t0 = Date.now();

		while (Date.now() - t0 < 300_000) {
			const list = await ModelsService.listRouter();
			const states = ids.map(
				(id) => (list.data ?? []).find((m: ApiModelDataEntry) => m.id === id)?.status?.value ?? ''
			);

			if (states.every((s: string) => s === 'loaded')) break;

			if (states.some((s: string) => s === 'failed' || s === 'error')) {
				throw new Error('The text model failed to load again. Load it from the Models window.');
			}

			await sleep(1000);
		}

		await modelsStore.fetchRouterModels().catch(() => undefined);

		if (ids[0]) await modelsStore.selectModelById(ids[0]).catch(() => undefined);
	}

	// ---------------------------------------------------------------- the swap

	private setPhase(phase: GenPhase, detail = '') {
		this.phase = phase;
		this.detail = detail;
	}

	cancel(): void {
		this.cancelled = true;

		if (this.jobId) {
			this.sd(`/sdcpp/v1/jobs/${this.jobId}/cancel`, { method: 'POST', body: '{}' }).catch(
				() => undefined
			);
		}
	}

	/**
	 * Full swap + generation. Resolves with the finished file, or null when it failed / was
	 * cancelled. Text models are brought back in every case.
	 */
	async run(
		kind: GenKind,
		prompt: string,
		opts: GenOptions = {}
	): Promise<{ b64: string; mime: string; ext: string } | null> {
		if (this.busy) {
			toast.info('A generation is already running');

			return null;
		}

		opts = this.applyLimits(kind, opts);

		const c = this.config;
		const recipe = kind === 'image' ? c.imageRecipe : c.videoRecipe;
		const models = kind === 'image' ? c.imageModels : c.videoModels;

		if (!serverStore.isRouterMode) {
			this.fail(
				'Smart workload needs the Knome launcher (router mode), so text models can be swapped.'
			);

			return null;
		}

		if (!recipe) {
			this.fail(`No ${kind} model chosen yet. Open Settings → Image & video and pick one.`);

			return null;
		}

		this.cancelled = false;
		this.jobId = '';
		this.kind = kind;
		this.startedAt = Date.now();

		// check the image server BEFORE touching the text model, so a stopped server costs nothing
		try {
			const r = await this.sd<{ recipes: SdRecipe[] }>('/sdcpp/v1/recipes');

			this.recipes = r.recipes ?? this.recipes;
		} catch (e) {
			this.fail(e instanceof Error ? e.message : String(e));

			return null;
		}

		let loadedBefore: string[] = [];
		let result: { b64: string; mime: string; ext: string } | null = null;
		let error = '';

		try {
			// 1+2. remember and unload text models
			await modelsStore.fetchRouterModels().catch(() => undefined);
			loadedBefore = [...modelsStore.loadedModelIds];

			if (!loadedBefore.length && modelsStore.selectedModelId) {
				loadedBefore = [modelsStore.selectedModelId];
			}

			this.setPhase('unloading-text', 'Freeing memory: text model is being unloaded');
			await this.unloadTextModels(modelsStore.loadedModelIds);

			if (this.cancelled) throw new Error('cancelled');

			// 3. diffusion model + its parts
			this.setPhase('loading-diffusion', 'Loading the image model and its parts');
			const loadBody = JSON.stringify({ recipe, models });

			try {
				await this.sd('/sdcpp/v1/models/load', { method: 'POST', body: loadBody });
			} catch (e) {
				if (this.cancelled) throw e;

				// the image server may have been restarted (memory) - give it a moment and try once more
				this.setPhase('loading-diffusion', 'Retrying the image model once');
				await this.sd('/sdcpp/v1/models/unload', { method: 'POST', body: '{}' }).catch(
					() => undefined
				);
				await sleep(4000);
				await this.sd('/sdcpp/v1/models/load', { method: 'POST', body: loadBody });
			}

			if (this.cancelled) throw new Error('cancelled');

			// 4. generate
			this.setPhase('generating', kind === 'image' ? 'Drawing your image' : 'Rendering your video');
			result = await this.generate(kind, prompt, opts);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}

		// 5. always unload the diffusion model
		try {
			this.setPhase('unloading-diffusion', 'Unloading the image model');
			await this.sd('/sdcpp/v1/models/unload', { method: 'POST', body: '{}' });
		} catch (e) {
			if (!error) error = e instanceof Error ? e.message : String(e);
		}

		// 6. always bring the text model back
		if (loadedBefore.length) {
			try {
				this.setPhase('restoring-text', 'Bringing your text model back');
				await this.restoreTextModels(loadedBefore);
			} catch (e) {
				error = (error ? error + ' ' : '') + (e instanceof Error ? e.message : String(e));
			}
		}

		if (error && error !== 'cancelled') {
			this.fail(error);

			return null;
		}

		if (this.cancelled) {
			this.setPhase('idle');
			toast.info('Generation cancelled');

			return null;
		}

		this.setPhase('done', 'Ready');
		setTimeout(() => {
			if (this.phase === 'done') this.setPhase('idle');
		}, 2500);

		return result;
	}

	private fail(message: string) {
		this.setPhase('error', message);
		toast.error(message, { duration: 9000 });
		setTimeout(() => {
			if (this.phase === 'error') this.setPhase('idle');
		}, 9000);
	}

	private async generate(
		kind: GenKind,
		prompt: string,
		opts: GenOptions
	): Promise<{ b64: string; mime: string; ext: string }> {
		const c = this.config;
		const body: Record<string, unknown> = {
			prompt,
			negative_prompt: opts.negative ?? c.negative,
			width: opts.width ?? c.width,
			height: opts.height ?? c.height,
			seed: opts.seed ?? -1
		};
		const sp: Record<string, unknown> = {};
		const steps = opts.steps ?? (c.steps > 0 ? c.steps : 0);
		const cfg = opts.cfg ?? (c.cfg > 0 ? c.cfg : 0);

		if (steps > 0) sp.sample_steps = Math.min(150, Math.max(1, Math.round(steps)));

		if (cfg > 0) sp.guidance = { txt_cfg: cfg };

		if (opts.sampler) sp.sample_method = opts.sampler;

		if (Object.keys(sp).length) body.sample_params = sp;

		// pictures the user attached: edit models take them as references, others as img2img start
		if (opts.images?.length) {
			const rid = kind === 'image' ? c.imageRecipe : c.videoRecipe;
			const feats = this.recipes.find((r) => r.id === rid)?.features ?? [];

			if (feats.includes('ref_images')) {
				body.ref_images = opts.images;
			} else {
				body.init_image = opts.images[0];
				body.strength = opts.strength ?? 0.6;
			}
		}

		if (kind === 'video') {
			body.video_frames = opts.frames ?? c.videoFrames;
			body.fps = opts.fps ?? c.videoFps;
			body.output_format = c.videoFormat;
		}

		const job = await this.sd<{ id: string }>(
			kind === 'image' ? '/sdcpp/v1/img_gen' : '/sdcpp/v1/vid_gen',
			{ method: 'POST', body: JSON.stringify(body) }
		);

		this.jobId = job.id;

		for (;;) {
			await sleep(1200);

			const j = await this.sd<{
				status: string;
				error?: { message?: string } | string | null;
				result?: {
					images?: { b64_json: string }[];
					output_format?: string;
					mime_type?: string;
					b64_json?: string;
				};
			}>(`/sdcpp/v1/jobs/${job.id}`);

			this.detail = `${kind === 'image' ? 'Drawing' : 'Rendering'}… ${Math.round((Date.now() - this.startedAt) / 1000)}s`;

			if (j.status === 'completed') {
				this.jobId = '';

				if (kind === 'image') {
					const fmt = j.result?.output_format ?? 'png';
					const b64 = j.result?.images?.[0]?.b64_json;

					if (!b64) throw new Error('The image server returned no image.');

					return { b64, mime: `image/${fmt}`, ext: fmt };
				}

				const b64 = j.result?.b64_json;

				if (!b64) throw new Error('The image server returned no video.');

				const ext = j.result?.output_format ?? 'webm';

				return { b64, mime: j.result?.mime_type ?? `video/${ext}`, ext };
			}

			if (j.status === 'cancelled') {
				this.jobId = '';
				this.cancelled = true;
				throw new Error('cancelled');
			}

			if (j.status === 'failed') {
				this.jobId = '';
				const err = j.error;

				throw new Error(typeof err === 'string' ? err : (err?.message ?? 'The generation failed.'));
			}
		}
	}

	// ---------------------------------------------------------------- chat hook

	/**
	 * Called by chatStore after an AI reply (and its title) is finished. If the reply holds an
	 * <image_prompt> tag, run the swap and attach the result to that same message.
	 */
	async afterReply(messageId: string, content: string): Promise<void> {
		if (!this.config.enabled) return;

		const userText =
			[...conversationsStore.activeMessages].reverse().find((x) => x.role === 'user')?.content ??
			'';

		// the streamed text can be empty/partial (tool flow); the saved message is the truth
		if (!TAG_RE.test(content)) {
			const stored = conversationsStore.activeMessages.find((x) => x.id === messageId)?.content;

			if (stored && TAG_RE.test(stored)) content = stored;
		}

		const m = TAG_RE.exec(content);
		let kind: GenKind | null = m ? (m[1].toLowerCase() as GenKind) : null;
		let prompt = m ? m[3].trim() : '';
		const opts: GenOptions = m ? parseAttrs(m[2]) : {};

		// armed but the model forgot the tag: fall back to what the user typed
		if (!kind && this.armed) {
			kind = this.armed;
			prompt = userText.trim();
		}

		if (!kind || !prompt) return;

		if (kind === 'image' && !this.config.image) return;

		if (kind === 'video' && !this.config.video) return;

		this.manualOn = this.armed !== null;
		this.armed = null;

		const clean = this.stripTag(content);

		await this.applyContent(messageId, clean);

		// pictures the user attached to their last message are sent along (edit / reference)
		const lastUser = [...conversationsStore.activeMessages]
			.reverse()
			.find((x) => x.role === 'user');
		const attached = (lastUser?.extra ?? [])
			.filter((e: DatabaseMessageExtra) => e.type === 'IMAGE')
			.map((e: DatabaseMessageExtra) => (e as DatabaseMessageExtraImageFile).base64Url)
			.filter(Boolean);

		if (attached.length) opts.images = attached;

		const out = await this.run(kind, prompt, opts);

		this.manualOn = false;

		if (!out) return;

		const idx = conversationsStore.findMessageIndex(messageId);

		if (idx === -1) return;

		const msg = conversationsStore.activeMessages[idx];
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const dataUrl = `data:${out.mime};base64,${out.b64}`;
		const isVideo = kind === 'video' && out.mime.startsWith('video/');
		const extra = isVideo
			? {
					type: AttachmentType.VIDEO,
					name: `knome-${stamp}.${out.ext}`,
					base64Data: out.b64,
					mimeType: out.mime
				}
			: {
					type: AttachmentType.IMAGE,
					name: `knome-${stamp}.${out.ext}`,
					base64Url: dataUrl
				};
		const note = this.config.announce
			? `${clean ? clean + '\n\n' : ''}✅ ${kind === 'image' ? 'Image' : 'Video'} ready.`
			: clean;
		const extras = [...(msg.extra ?? []), extra] as DatabaseMessageExtra[];

		conversationsStore.updateMessageAtIndex(idx, { content: note, extra: extras });
		await DatabaseService.updateMessage(messageId, { content: note, extra: extras });
	}

	private async applyContent(messageId: string, content: string): Promise<void> {
		const idx = conversationsStore.findMessageIndex(messageId);

		if (idx !== -1) conversationsStore.updateMessageAtIndex(idx, { content });

		await DatabaseService.updateMessage(messageId, { content });
	}
}

export const imageGenStore = new ImageGenStore();
