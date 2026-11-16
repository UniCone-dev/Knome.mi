/**
 * livingStore - settings for the living character stage and the text that tells the model how to
 * pick an emotion. A character is "living" when its card has emotion media (Characters > Edit emotions).
 */
import { browser } from '$app/environment';
import { CORE_EMOTION_STATES, baseEmotionKey } from '$lib/constants';
import { charactersStore } from '$lib/stores/characters/index.svelte';
import { LivingPlayer } from '$lib/stores/living-player.svelte';
import type { EmotionSet } from '$lib/types/database';
import { emotionHasMedia } from '$lib/utils/emotion-media';

const ENABLED_KEY = 'Knome.livingEnabled';
const SIZE_KEY = 'Knome.livingSize';
const MODE_KEY = 'Knome.livingMode';
const POS_KEY = 'Knome.livingPos';

/** avatar: the character's profile picture becomes the living picture; floating: a small window. */
export type LivingMode = 'avatar' | 'floating';

export const LIVING_SIZE_MIN = 100;
export const LIVING_SIZE_MAX = 360;
export const LIVING_SIZE_DEFAULT = 180;

function readPos(): { x: number; y: number } | null {
	if (!browser) return null;

	try {
		const v = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null');

		return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null;
	} catch {
		return null;
	}
}

function readSize(): number {
	if (!browser) return LIVING_SIZE_DEFAULT;

	const n = Number(localStorage.getItem(SIZE_KEY));

	return n >= LIVING_SIZE_MIN && n <= LIVING_SIZE_MAX ? n : LIVING_SIZE_DEFAULT;
}

class LivingStore {
	enabled = $state(browser ? localStorage.getItem(ENABLED_KEY) !== '0' : true);
	size = $state(readSize());
	mode = $state<LivingMode>(
		browser && localStorage.getItem(MODE_KEY) === 'floating' ? 'floating' : 'avatar'
	);
	/** Where the user dragged the floating window (null = top right corner). */
	pos = $state<{ x: number; y: number } | null>(readPos());
	/** One player for the whole app: every living picture on screen shows this same state. */
	readonly player = new LivingPlayer();

	/** The active AI character, only when it has any emotion media. */
	character = $derived.by(() => {
		const c = charactersStore.activeCharacter;

		return c?.emotions &&
			(Object.values(c.emotions) as EmotionSet[]).some((e) => emotionHasMedia(e))
			? c
			: undefined;
	});

	visible = $derived(this.enabled && this.character !== undefined);

	/** Emotions of the active character that have media (not idle / thinking / ...). */
	emotionNames = $derived.by(() => {
		const keys = Object.keys(this.character?.emotions ?? {}).filter((k) =>
			emotionHasMedia(this.character?.emotions?.[k])
		);
		const core = new Set(CORE_EMOTION_STATES.map((s) => s.key));

		return [...new Set(keys.map(baseEmotionKey))].filter((k) => !core.has(k)).sort();
	});

	setEnabled(on: boolean) {
		this.enabled = on;

		try {
			localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
		} catch {
			/* storage unavailable */
		}
	}

	setPos(pos: { x: number; y: number } | null) {
		this.pos = pos;

		try {
			if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
			else localStorage.removeItem(POS_KEY);
		} catch {
			/* storage unavailable */
		}
	}

	setMode(mode: LivingMode) {
		this.mode = mode;

		try {
			localStorage.setItem(MODE_KEY, mode);
		} catch {
			/* storage unavailable */
		}
	}

	setSize(px: number) {
		this.size = Math.max(LIVING_SIZE_MIN, Math.min(LIVING_SIZE_MAX, Math.round(px)));

		try {
			localStorage.setItem(SIZE_KEY, String(this.size));
		} catch {
			/* storage unavailable */
		}
	}

	/** Added to the system message while a living character is on screen. */
	buildPromptBlock(): string {
		if (!this.visible || this.emotionNames.length === 0) return '';

		return (
			'You are shown on screen as a living character: your face changes with your feelings. ' +
			'Start EVERY reply with one emotion tag in square brackets, [emo:NAME], that matches how you ' +
			'feel in that reply. You may write another tag later in the reply when your feeling changes. ' +
			`Allowed names: ${this.emotionNames.join(', ')}. Use only these names. The tag is hidden from ` +
			'the user: never explain it and never mention it.'
		);
	}
}

export const livingStore = new LivingStore();
