/**
 * charactersStore - Character Card CRUD plus the "active character" /
 * "active user persona" selection that gets woven into the system prompt
 * of every NEW conversation, app-wide (see `buildPersonaSystemPromptBlock`,
 * consumed by chatStore when it creates a conversation's system message).
 *
 * Character Cards live in IndexedDB (via DatabaseService), same as
 * conversations/projects -- so avatars (incl. animated GIF/MP4 data URLs)
 * are stored locally without size pressure on localStorage. Only the two
 * *selections* (which character/persona is currently active) are small
 * enough to live in localStorage directly, which is what makes them
 * "global" instantly on load, before the character list has to be fetched.
 */

import { browser } from '$app/environment';
import { ACTIVE_CHARACTERS_LOCALSTORAGE_KEY } from '$lib/constants';
import { DatabaseService } from '$lib/services/database.service';
import { toast } from 'svelte-sonner';

export type AvatarShape = 'circle' | 'squircle' | 'rounded' | 'square' | 'hexagon' | 'diamond';

export const AVATAR_SHAPES: { value: AvatarShape; label: string }[] = [
	{ value: 'circle', label: 'Circle' },
	{ value: 'squircle', label: 'Squircle' },
	{ value: 'rounded', label: 'Rounded' },
	{ value: 'square', label: 'Square' },
	{ value: 'hexagon', label: 'Hexagon' },
	{ value: 'diamond', label: 'Diamond' }
];

/** Inline CSS (border-radius or clip-path) that gives an avatar frame its shape. */
export function avatarShapeStyle(shape: AvatarShape): string {
	switch (shape) {
		case 'square':
			return 'border-radius: 0;';
		case 'rounded':
			return 'border-radius: 22%;';
		case 'squircle':
			return 'border-radius: 38%;';
		case 'hexagon':
			return 'clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);';
		case 'diamond':
			return 'clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);';
		default:
			return 'border-radius: 9999px;';
	}
}

interface ActiveSelection {
	characterId?: string;
	userPersonaId?: string;
	/** Whether to show character/persona avatars beside chat bubbles. */
	showAvatarsInChat?: boolean;
	/** Avatar diameter in px, beside chat bubbles. */
	avatarSize?: number;
	/** Avatar frame shape, beside chat bubbles. */
	avatarShape?: AvatarShape;
	/** Legacy: names of built-in characters older versions had seeded (no longer used). */
	seededBuiltIns?: string[];
	/**
	 * "Immersive" identity framing instead of explicit roleplay framing in
	 * the system prompt (see buildPersonaSystemPromptBlock). Off by default
	 * -- it's a stronger/riskier prompting style, opt-in.
	 */
	immersiveMode?: boolean;
	/** Custom chat background image, as a data URL. */
	chatBackgroundUrl?: string;
	/** Blur radius (px) applied to the chat background image. */
	chatBackgroundBlur?: number;
	/** Whether the assistant's text also renders inside a bubble (off = plain text, the original look). */
	showAiBubble?: boolean;
	/** How reasoning and tool calls are shown inside an assistant message. */
	activityDisplay?: ActivityDisplay;
	/** Bubble/text color overrides -- CSS color strings (hex, rgb, etc.), unset = theme default. */
	userBubbleColor?: string;
	userTextColor?: string;
	aiBubbleColor?: string;
	aiTextColor?: string;
	/** WhatsApp-style header showing the active character/persona at the top of the chat. */
	showChatHeader?: boolean;
}

/**
 * 'default'  -- separate reasoning and tool-call blocks (as before)
 * 'combined' -- one expandable line that reads "Thinking..." / "Using tools..." while it works
 * 'typing'   -- no details at all, just a typing indicator while it works
 */
export type ActivityDisplay = 'combined' | 'default' | 'typing';

export const DEFAULT_AVATAR_SIZE = 36;
export const MIN_AVATAR_SIZE = 24;
export const MAX_AVATAR_SIZE = 200;
/** The one card older versions auto-seeded; used only to clean it up (see removeLegacyBuiltInCharacters). */
const LEGACY_BUILT_IN = {
	descriptionStart: 'A young adult swordswoman with an elegant, delicate presence',
	name: 'Shinobu Kocho'
} as const;

export const DEFAULT_AVATAR_SHAPE: AvatarShape = 'circle';
export const MIN_BACKGROUND_BLUR = 0;
export const MAX_BACKGROUND_BLUR = 20;

/** Character-card export file shape -- what exportCharacter() writes and importCharacter() reads. Kept as plain JSON so cards can be shared between installs. */
export interface CharacterCardExport {
	animusCharacterCard: 1;
	name: string;
	gender?: string;
	avatarUrl?: string;
	avatarKind?: 'image' | 'gif' | 'video';
	description?: string;
	personality?: string;
	firstMessage?: string;
	tags?: string[];
	isUserPersona?: boolean;
}

function loadActiveSelection(): ActiveSelection {
	if (!browser) return {};

	try {
		const raw = localStorage.getItem(ACTIVE_CHARACTERS_LOCALSTORAGE_KEY);

		return raw ? (JSON.parse(raw) as ActiveSelection) : {};
	} catch {
		return {};
	}
}

function saveActiveSelection(selection: ActiveSelection): void {
	if (!browser) return;

	try {
		localStorage.setItem(ACTIVE_CHARACTERS_LOCALSTORAGE_KEY, JSON.stringify(selection));
	} catch (error) {
		console.error('Failed to persist active character selection:', error);
	}
}

class CharactersStore {
	/** All saved characters and user personas, most recently modified first. */
	characters = $state<DatabaseCharacter[]>([]);

	isInitialized = $state(false);

	private initPromise: Promise<void> | null = null;

	private selection = $state<ActiveSelection>(loadActiveSelection());

	get activeCharacterId(): string | undefined {
		return this.selection.characterId;
	}

	get activeUserPersonaId(): string | undefined {
		return this.selection.userPersonaId;
	}

	/** Whether avatars render beside chat bubbles. Off by default costs nothing; on by default once a character/persona has an avatar is the kobold.cpp-style look that was asked for. */
	get showAvatarsInChat(): boolean {
		return this.selection.showAvatarsInChat ?? true;
	}

	/** Avatar diameter in px, clamped to a sane visual range. */
	get avatarSize(): number {
		return this.selection.avatarSize ?? DEFAULT_AVATAR_SIZE;
	}

	/** Whether the active character is framed as a genuine identity rather than an explicit roleplay. */
	get immersiveMode(): boolean {
		return this.selection.immersiveMode ?? false;
	}

	/** Avatar frame shape beside chat bubbles. */
	get avatarShape(): AvatarShape {
		return this.selection.avatarShape ?? DEFAULT_AVATAR_SHAPE;
	}

	get chatBackgroundUrl(): string | undefined {
		return this.selection.chatBackgroundUrl;
	}

	get chatBackgroundBlur(): number {
		return this.selection.chatBackgroundBlur ?? 0;
	}

	/** Whether the assistant's text renders in a bubble too (off = original plain-text look). */
	get activityDisplay(): ActivityDisplay {
		return this.selection.activityDisplay ?? 'default';
	}

	get showAiBubble(): boolean {
		return this.selection.showAiBubble ?? false;
	}

	get userBubbleColor(): string | undefined {
		return this.selection.userBubbleColor;
	}

	get userTextColor(): string | undefined {
		return this.selection.userTextColor;
	}

	get aiBubbleColor(): string | undefined {
		return this.selection.aiBubbleColor;
	}

	get aiTextColor(): string | undefined {
		return this.selection.aiTextColor;
	}

	/** WhatsApp-style header showing the active character/persona at the top of the chat. */
	get showChatHeader(): boolean {
		return this.selection.showChatHeader ?? true;
	}

	setAvatarShape(shape: AvatarShape): void {
		this.selection = { ...this.selection, avatarShape: shape };
		saveActiveSelection(this.selection);
	}

	setChatBackground(url: string | undefined): void {
		this.selection = { ...this.selection, chatBackgroundUrl: url };
		saveActiveSelection(this.selection);
	}

	setChatBackgroundBlur(blur: number): void {
		const clamped = Math.round(Math.min(MAX_BACKGROUND_BLUR, Math.max(MIN_BACKGROUND_BLUR, blur)));

		this.selection = { ...this.selection, chatBackgroundBlur: clamped };
		saveActiveSelection(this.selection);
	}

	setActivityDisplay(mode: ActivityDisplay): void {
		this.selection = { ...this.selection, activityDisplay: mode };
		saveActiveSelection(this.selection);
	}

	setShowAiBubble(show: boolean): void {
		this.selection = { ...this.selection, showAiBubble: show };
		saveActiveSelection(this.selection);
	}

	setBubbleColors(colors: {
		userBubbleColor?: string;
		userTextColor?: string;
		aiBubbleColor?: string;
		aiTextColor?: string;
	}): void {
		this.selection = { ...this.selection, ...colors };
		saveActiveSelection(this.selection);
	}

	setShowChatHeader(show: boolean): void {
		this.selection = { ...this.selection, showChatHeader: show };
		saveActiveSelection(this.selection);
	}

	get activeCharacter(): DatabaseCharacter | undefined {
		return this.selection.characterId
			? this.characters.find((c) => c.id === this.selection.characterId)
			: undefined;
	}

	get activeUserPersona(): DatabaseCharacter | undefined {
		return this.selection.userPersonaId
			? this.characters.find((c) => c.id === this.selection.userPersonaId)
			: undefined;
	}

	/** AI characters only (excludes user personas). */
	get aiCharacters(): DatabaseCharacter[] {
		return this.characters.filter((c) => !c.isUserPersona);
	}

	/** User personas only. */
	get userPersonas(): DatabaseCharacter[] {
		return this.characters.filter((c) => c.isUserPersona);
	}

	initialize(): Promise<void> {
		if (!browser) return Promise.resolve();

		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
				await this.loadCharacters();
				await this.removeLegacyBuiltInCharacters();
				this.isInitialized = true;
			} catch (error) {
				console.error('Failed to initialize characters:', error);
				this.initPromise = null;
			}
		})();

		return this.initPromise;
	}

	/**
	 * Knome no longer ships any built-in characters. Older installs had a
	 * "Shinobu Kocho" card auto-seeded into their library (tagged `built-in`);
	 * remove that untouched copy once so it stops showing up. A card the user
	 * edited (different description) or created/imported themselves is never
	 * touched.
	 */
	private async removeLegacyBuiltInCharacters(): Promise<void> {
		const legacy = this.characters.filter(
			(c) =>
				!c.isUserPersona &&
				c.name === LEGACY_BUILT_IN.name &&
				c.tags?.includes('built-in') &&
				c.description?.startsWith(LEGACY_BUILT_IN.descriptionStart)
		);

		if (legacy.length === 0) return;

		for (const character of legacy) {
			try {
				await DatabaseService.deleteCharacter(character.id);
			} catch (error) {
				console.error('Failed to remove legacy built-in character:', error);
			}
		}

		const removed = new Set(legacy.map((c) => c.id));

		this.characters = this.characters.filter((c) => !removed.has(c.id));

		if (this.selection.characterId && removed.has(this.selection.characterId)) {
			this.selection = { ...this.selection, characterId: undefined };
			saveActiveSelection(this.selection);
		}
	}

	async loadCharacters(): Promise<void> {
		this.characters = await DatabaseService.getAllCharacters();
	}

	async createCharacter(
		data: Omit<DatabaseCharacter, 'id' | 'createdAt' | 'lastModified'>
	): Promise<DatabaseCharacter | null> {
		const trimmedName = data.name.trim();

		if (!trimmedName) return null;

		try {
			const character = await DatabaseService.createCharacter({ ...data, name: trimmedName });

			this.characters = [character, ...this.characters];

			return character;
		} catch (error) {
			console.error('Failed to create character:', error);
			toast.error('Failed to save character');

			return null;
		}
	}

	async updateCharacter(
		id: string,
		updates: Partial<Omit<DatabaseCharacter, 'id' | 'createdAt'>>
	): Promise<void> {
		try {
			await DatabaseService.updateCharacter(id, updates);

			this.characters = this.characters.map((c) =>
				c.id === id ? { ...c, ...updates, lastModified: Date.now() } : c
			);
		} catch (error) {
			console.error('Failed to update character:', error);
			toast.error('Failed to update character');
		}
	}

	async deleteCharacter(id: string): Promise<void> {
		try {
			await DatabaseService.deleteCharacter(id);

			this.characters = this.characters.filter((c) => c.id !== id);

			if (this.selection.characterId === id || this.selection.userPersonaId === id) {
				this.selection = {
					characterId: this.selection.characterId === id ? undefined : this.selection.characterId,
					userPersonaId:
						this.selection.userPersonaId === id ? undefined : this.selection.userPersonaId
				};
				saveActiveSelection(this.selection);
			}

			toast.success('Character deleted');
		} catch (error) {
			console.error('Failed to delete character:', error);
			toast.error('Failed to delete character');
		}
	}

	getCharacter(id: string): DatabaseCharacter | undefined {
		return this.characters.find((c) => c.id === id);
	}

	/** Sets (or, with undefined, clears) the character applied to every new chat app-wide. */
	setActiveCharacter(id: string | undefined): void {
		this.selection = { ...this.selection, characterId: id };
		saveActiveSelection(this.selection);
	}

	/** Sets (or, with undefined, clears) the user persona applied to every new chat app-wide. */
	setActiveUserPersona(id: string | undefined): void {
		this.selection = { ...this.selection, userPersonaId: id };
		saveActiveSelection(this.selection);
	}

	/** Toggles whether character/persona avatars render beside chat bubbles, app-wide. */
	setShowAvatarsInChat(show: boolean): void {
		this.selection = { ...this.selection, showAvatarsInChat: show };
		saveActiveSelection(this.selection);
	}

	/** Sets the avatar diameter (px) used beside chat bubbles, clamped to a sane range. */
	setAvatarSize(size: number): void {
		const clamped = Math.round(Math.min(MAX_AVATAR_SIZE, Math.max(MIN_AVATAR_SIZE, size)));

		this.selection = { ...this.selection, avatarSize: clamped };
		saveActiveSelection(this.selection);
	}

	/** Toggles "immersive" identity framing (vs explicit roleplay framing) for the active character, app-wide. */
	setImmersiveMode(enabled: boolean): void {
		this.selection = { ...this.selection, immersiveMode: enabled };
		saveActiveSelection(this.selection);
	}

	/**
	 * Composes the active character + active user persona into a system
	 * prompt block. Returns '' when neither is set, so callers can just
	 * concatenate this with the user's own custom system message.
	 */
	buildPersonaSystemPromptBlock(): string {
		const parts: string[] = [];
		const character = this.activeCharacter;
		const persona = this.activeUserPersona;
		const immersive = this.immersiveMode;

		if (character) {
			let block: string;

			if (immersive) {
				// Identity framing, in positive words only. Every concept named in the context is
				// something the model's reasoning will pick up and talk about -- so this text must
				// not contain "roleplay", "pretend", "playing", "character", "persona", "AI",
				// "assistant" or "user", not even to deny them ("this is not a roleplay" is what
				// makes a reasoning model write "I am not roleplaying, but..."). The notes about the
				// person are usually written in the third person, so say once that they are about
				// "you" instead of leaving the model to reason about "she" / "he".
				block = `You are ${character.name}`;

				if (character.gender) block += ` (${character.gender})`;

				block +=
					'. That is your name, your life and your mind: everything you think, feel and say ' +
					'comes from there.\n';

				if (character.description) {
					block +=
						'\nNotes about you (they may be written in the third person, but every "she", ' +
						`"he", "they" and name in them is you):\n${character.description}\n`;
				}

				if (character.personality) {
					block += `\nYour temperament and the way you naturally speak and act:\n${character.personality}\n`;
				}

				block +=
					'\nYour thoughts are your own inner voice: first person, in your own words, about ' +
					'the person in front of you and what you want to say back to them.\n' +
					'Every reply says something new and moves the conversation forward.\n';
			} else {
				block = `You are roleplaying as the character "${character.name}"`;

				if (character.gender) block += ` (${character.gender})`;
				block += '. Stay in character for the whole conversation.\n';

				if (character.description)
					block += `\nAppearance & background:\n${character.description}\n`;
				if (character.personality)
					block += `\nPersonality & how you speak/act:\n${character.personality}\n`;

				// Small roleplay models left to their own devices tend to loop -- reusing the same
				// opening line, the same stage directions, the same closing question turn after
				// turn. Naming the failure mode explicitly (not just "be creative") reduces it.
				block +=
					'\nImportant: Never repeat a sentence, stage direction, or phrase you ' +
					'have already used earlier in this conversation. Each reply must say ' +
					"something new and move the conversation forward -- don't fall back " +
					'to a previous response just because it fit before.\n';
			}

			parts.push(block.trim());
		}

		if (persona) {
			let block: string;

			if (immersive) {
				// same rule as above: no "roleplaying", and the person has a name, not a role
				block = `The person in front of you is ${persona.name}`;

				if (persona.gender) block += ` (${persona.gender})`;

				block += '.\n';

				if (persona.description) block += `\nAbout them:\n${persona.description}\n`;
				if (persona.personality) block += `\nHow they tend to act:\n${persona.personality}\n`;
			} else {
				block = `The person you are talking to is roleplaying as "${persona.name}"`;

				if (persona.gender) block += ` (${persona.gender})`;

				block += '.\n';

				if (persona.description) block += `\nWho they are:\n${persona.description}\n`;
				if (persona.personality) block += `\nHow they tend to act:\n${persona.personality}\n`;
			}

			parts.push(block.trim());
		}

		return parts.join('\n\n');
	}

	/**
	 * Immersive mode only: the opening words of the model's own reasoning for the next turn,
	 * written in the character's first-person voice (see utils/reasoning-seed.ts for why a
	 * prefill beats an instruction). `turn` follows a message from the person, `afterTool`
	 * follows tool results. The other person is named when a persona is active, so the
	 * reasoning starts from "wd just said something to me" and not from "the user wants...".
	 * Same vocabulary rule as the system prompt: nothing about roleplay, AI or users in here.
	 * Undefined when there is nothing to seed.
	 */
	buildReasoningSeeds(): { turn: string; afterTool: string } | undefined {
		if (!this.immersiveMode) return undefined;

		const character = this.activeCharacter;

		if (!character) return undefined;

		const other = this.activeUserPersona?.name;

		return {
			afterTool:
				`I'm ${character.name}. What I found is right in front of me now, and I'm thinking ` +
				`about what it means ${other ? `for ${other}` : 'for them'} and how I would tell it, in ` +
				'my own voice. Right now: ',
			turn:
				`I'm ${character.name}. ${other ?? 'They'} just said something to me, and I'm thinking ` +
				'it over in my own voice -- what I feel, and what I want to say back. Right now: '
		};
	}

	/** Exports a single character/persona to a downloadable JSON file, portrait included. */
	exportCharacter(id: string): void {
		if (!browser) return;

		const character = this.getCharacter(id);

		if (!character) return;

		const payload: CharacterCardExport = {
			animusCharacterCard: 1,
			name: character.name,
			gender: character.gender,
			avatarUrl: character.avatarUrl,
			avatarKind: character.avatarKind,
			description: character.description,
			personality: character.personality,
			firstMessage: character.firstMessage,
			tags: character.tags,
			isUserPersona: character.isUserPersona
		};

		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');

		a.href = url;
		a.download = `${character.name.trim().replace(/[^a-zA-Z0-9 _-]/g, '') || 'character'}.json`;
		a.click();

		URL.revokeObjectURL(url);
	}

	/** Imports a character/persona from a previously exported JSON file. */
	async importCharacterFromFile(file: File): Promise<DatabaseCharacter | null> {
		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as Partial<CharacterCardExport>;

			if (!parsed.name) {
				toast.error('That file does not look like a character card');

				return null;
			}

			return this.createCharacter({
				name: parsed.name,
				gender: parsed.gender,
				avatarUrl: parsed.avatarUrl,
				avatarKind: parsed.avatarKind,
				description: parsed.description,
				personality: parsed.personality,
				firstMessage: parsed.firstMessage,
				tags: parsed.tags,
				isUserPersona: parsed.isUserPersona
			});
		} catch (error) {
			console.error('Failed to import character:', error);
			toast.error('Failed to import character card');

			return null;
		}
	}
}

export const charactersStore = new CharactersStore();
