/**
 * Living characters: the states and emotions a character card can have media for.
 *
 * Keys stored in `DatabaseCharacter.emotions`:
 *   idle | listening | thinking | speaking         core states
 *   <emotion>                                      how the character looks while feeling it
 *   <emotion>:speaking                             talking while feeling it
 */
export const EMOTION_HOLD_DEFAULT_SECONDS = 5;
export const EMOTION_HOLD_MIN_SECONDS = 1;
export const EMOTION_HOLD_MAX_SECONDS = 5;
export const EMOTION_STEP_DEFAULT_SECONDS = 1.5;
export const EMOTION_MAX_CLIP_BYTES = 25 * 1024 * 1024;

export const EMOTION_ACCEPT = 'video/mp4,video/webm,image/gif,image/png,image/jpeg,image/webp';

export interface EmotionState {
	key: string;
	label: string;
	hint?: string;
}

/** Core states. `idle` only has a loop; thinking's end part leads into the speaking part. */
export const CORE_EMOTION_STATES: EmotionState[] = [
	{ key: 'idle', label: 'Idle', hint: 'Resting. Plays whenever nothing else does.' },
	{ key: 'listening', label: 'Listening', hint: 'While you talk or type.' },
	{
		key: 'thinking',
		label: 'Thinking',
		hint: 'While the AI thinks. Start: idle to thinking. Loop: thinking. End: thinking to speaking.'
	},
	{ key: 'speaking', label: 'Speaking', hint: 'Plain talking, used when no emotion fits.' }
];

export const FEELING_NAMES = [
	'happy', 'excited', 'joyful', 'laughing', 'amused', 'playful', 'proud', 'confident', 'smug',
	'loving', 'affectionate', 'grateful', 'hopeful', 'relieved', 'calm', 'content', 'curious',
	'surprised', 'shocked', 'confused', 'thoughtful', 'serious', 'determined', 'focused',
	'sad', 'crying', 'lonely', 'disappointed', 'guilty', 'apologetic', 'embarrassed', 'shy',
	'nervous', 'anxious', 'scared', 'worried', 'annoyed', 'angry', 'furious', 'jealous',
	'disgusted', 'bored', 'sleepy', 'tired', 'sarcastic', 'mischievous', 'flirty', 'cheering',
	'whispering', 'neutral'
] as const;

export const FEELING_STATES: EmotionState[] = FEELING_NAMES.map((n) => ({
	key: n,
	label: n.charAt(0).toUpperCase() + n.slice(1)
}));

export const SPEAKING_SUFFIX = ':speaking';

export function isSpeakingKey(key: string): boolean {
	return key.endsWith(SPEAKING_SUFFIX);
}

export function baseEmotionKey(key: string): string {
	return isSpeakingKey(key) ? key.slice(0, -SPEAKING_SUFFIX.length) : key;
}

/** A key a user may add: short, lower case, letters / numbers / dashes. */
export function normalizeEmotionName(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 24);
}
