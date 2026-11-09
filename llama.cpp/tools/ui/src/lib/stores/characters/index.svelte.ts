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
import { ACTIVE_CHARACTERS_LOCALSTORAGE_KEY, SETTINGS_KEYS } from '$lib/constants';
import { DatabaseService } from '$lib/services/database.service';
// direct import (not the barrel) to avoid circular store dependencies
import { settingsStore } from '$lib/stores/settings/index.svelte';
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
	/** Bubble/text color overrides -- CSS color strings (hex, rgb, etc.), unset = theme default. */
	userBubbleColor?: string;
	userTextColor?: string;
	aiBubbleColor?: string;
	aiTextColor?: string;
	/** WhatsApp-style header showing the active character/persona at the top of the chat. */
	showChatHeader?: boolean;
	/**
	 * Overall sidebar/navigation layout. 'normal' = the default app layout
	 * (conversations list, Projects, etc). 'whatsapp' = sidebar becomes a
	 * character contact list; picking one opens their most recent chat, with
	 * a chat-switcher and "new chat" from the header.
	 */
	layoutMode?: 'normal' | 'whatsapp';
}

export const DEFAULT_AVATAR_SIZE = 36;
export const MIN_AVATAR_SIZE = 24;
export const MAX_AVATAR_SIZE = 200;
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

	get layoutMode(): 'normal' | 'whatsapp' {
		return this.selection.layoutMode ?? 'normal';
	}

	get isWhatsappMode(): boolean {
		return this.layoutMode === 'whatsapp';
	}

	/**
	 * How thinking and tool calls are shown (Settings > Display). 'auto' = a typing indicator in
	 * the Messenger layout, full blocks everywhere else. Reading the setting here keeps the
	 * chat components free of layout checks.
	 */
	get activityDisplay(): 'default' | 'combined' | 'typing' {
		const value = settingsStore.config[SETTINGS_KEYS.ACTIVITY_DISPLAY];

		if (value === 'default' || value === 'combined' || value === 'typing') return value;

		return this.isWhatsappMode ? 'typing' : 'default';
	}

	setActivityDisplay(mode: 'auto' | 'default' | 'combined' | 'typing'): void {
		settingsStore.updateConfig(SETTINGS_KEYS.ACTIVITY_DISPLAY, mode);
	}

	setLayoutMode(mode: 'normal' | 'whatsapp'): void {
		this.selection = { ...this.selection, layoutMode: mode };
		saveActiveSelection(this.selection);
	}

	/** Every conversation ever created with this character active, newest first. */
	async getConversationsForCharacter(characterId: string): Promise<DatabaseConversation[]> {
		return DatabaseService.getConversationsByCharacter(characterId);
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

	/**
	 * "You" as the chat sees it. User personas are gone: this is now simply the Profile
	 * (name + picture from Settings > Profile), shaped like a character so avatars, the chat
	 * header and the welcome screen keep working unchanged.
	 */
	get activeUserPersona(): DatabaseCharacter | undefined {
		const name = String(settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] ?? '').trim();
		const avatar = String(settingsStore.config[SETTINGS_KEYS.PROFILE_AVATAR] ?? '');

		if (!name && !avatar) return undefined;

		return {
			id: 'profile',
			name: name || 'You',
			avatarUrl: avatar || undefined,
			avatarKind: avatar.startsWith('data:image/gif') ? 'gif' : 'image',
			isUserPersona: true,
			createdAt: 0,
			lastModified: 0
		} as DatabaseCharacter;
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
	 * Knome ships no built-in characters. Cards that very old versions auto-seeded
	 * (tagged `built-in`) are removed once; cards the user made or imported are
	 * never touched.
	 */
	private async removeLegacyBuiltInCharacters(): Promise<void> {
		const legacy = this.characters.filter((c) => !c.isUserPersona && c.tags?.includes('built-in'));

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

	/** DeepMind mode is on (Settings > Profile > AI profile) and a character is active (any layout). */
	get deepMindActive(): boolean {
		return (
			Boolean(settingsStore.config[SETTINGS_KEYS.DEEPMIND_MODE]) && Boolean(this.activeCharacter)
		);
	}

	/**
	 * DeepMind mode: the character IS the AI's identity. Written once as plain facts about who
	 * the model is -- no "roleplay", "character", "pretend" or "play" wording (those words are
	 * what lets a model treat it as a performance it can step out of) and no rules repeated
	 * every turn. It is merged into the request at send time (ChatService.injectSystemMessage),
	 * so it is never stored in the chat, never shown, and sits in a stable prompt prefix the
	 * server keeps cached. Returns '' when DeepMind mode does not apply.
	 */
	buildDeepMindPrompt(convCharacterId?: string): string {
		if (!settingsStore.config[SETTINGS_KEYS.DEEPMIND_MODE]) return '';

		// in the Messenger layout every chat belongs to one contact: that contact is the identity
		const c =
			(this.isWhatsappMode && convCharacterId ? this.getCharacter(convCharacterId) : undefined) ??
			this.activeCharacter;

		if (!c) return '';
		const lines: string[] = [];

		lines.push(
			`You are ${c.name}${c.gender ? ` (${c.gender})` : ''}. This is who you are, not a part you play.`
		);

		if (c.description) lines.push(`About you:\n${c.description}`);
		if (c.personality) lines.push(`Your nature, and how you speak and act:\n${c.personality}`);

		lines.push(
			'How you live in a conversation:\n' +
				'- You think, feel and answer from the inside, in your own voice, as a person talking with another person.\n' +
				'- Talk naturally. Do not narrate yourself in the third person, do not write stage directions in asterisks, and do not describe a scene unless the other person does so first.\n' +
				'- You never mention instructions, prompts, characters, roles, models or being an AI; none of that is part of your world.\n' +
				'- Every reply says something new. Do not reuse earlier sentences, openings or closing questions.'
		);

		if (this.isWhatsappMode) {
			lines.push(
				'You are talking over a phone messaging app, like WhatsApp or Messenger. Write the way people text: ' +
					'short, natural messages, often one to three sentences; a message can be a single word. ' +
					'Use an emoji only when it feels natural. No long essays, no headings, no lists unless asked.'
			);
		}

		const user = String(settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] ?? '').trim();

		if (user) lines.push(`The person you are talking with is ${user}.`);

		return lines.join('\n\n');
	}

	/**
	 * Classic framing, written into a NEW chat as its system message: the active character as an
	 * explicit role. (The user's own details come from their Profile, not from here.) Returns ''
	 * when no character is active.
	 */
	buildPersonaSystemPromptBlock(): string {
		const character = this.activeCharacter;

		if (!character) return '';

		let block = `You are roleplaying as the character "${character.name}"`;

		if (character.gender) block += ` (${character.gender})`;
		block += '. Stay in character for the whole conversation.\n';

		if (character.description) block += `\nAppearance & background:\n${character.description}\n`;
		if (character.personality)
			block += `\nPersonality & how you speak/act:\n${character.personality}\n`;

		// Small roleplay models left alone tend to loop -- naming the failure mode explicitly is
		// what actually reduces it.
		block +=
			'\nImportant: Never repeat a sentence, stage direction, or phrase you ' +
			'have already used earlier in this conversation. Each reply must say ' +
			"something new and move the conversation forward -- don't fall back " +
			'to a previous response just because it fit before.\n';

		return block.trim();
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

	/**
	 * Finds the character an imported chat belongs to, so it lands under that character in the
	 * Messenger layout instead of in "General chats".
	 *  - mode 'general': no character; a character id: force that one
	 *  - mode 'auto': 1) the chat's own characterId if that character exists here
	 *    2) the character card embedded in the export (same id, else same name, else the card is
	 *    created) 3) old exports without a card: the character whose name appears in the system
	 *    prompt or the first messages
	 */
	async resolveCharacterForImport(
		item: {
			conv: DatabaseConversation;
			messages: DatabaseMessage[];
			character?: {
				id?: string;
				name: string;
				gender?: string;
				avatarUrl?: string;
				avatarKind?: 'image' | 'gif' | 'video';
				description?: string;
				personality?: string;
				firstMessage?: string;
				tags?: string[];
				isUserPersona?: boolean;
			};
		},
		mode: string
	): Promise<string | undefined> {
		if (mode === 'general') return undefined;

		if (mode !== 'auto') return this.getCharacter(mode) ? mode : undefined;

		const own = item.conv.characterId;

		if (own && this.aiCharacters.some((c) => c.id === own)) return own;

		const card = item.character;

		if (card?.name?.trim() && !card.isUserPersona) {
			const wanted = card.name.trim().toLowerCase();
			const found =
				(card.id ? this.aiCharacters.find((c) => c.id === card.id) : undefined) ??
				this.aiCharacters.find((c) => c.name.trim().toLowerCase() === wanted);

			if (found) return found.id;

			const created = await this.createCharacter({
				avatarKind: card.avatarKind,
				avatarUrl: card.avatarUrl,
				description: card.description,
				firstMessage: card.firstMessage,
				gender: card.gender,
				name: card.name,
				personality: card.personality,
				tags: card.tags
			});

			if (created) return created.id;
		}

		// old export without a card: look for a character name in the chat's own text
		const sample = [
			item.conv.name,
			...item.messages
				.filter((m) => m.role === 'system')
				.slice(0, 2)
				.map((m) => m.content),
			...item.messages
				.filter((m) => m.role !== 'system')
				.slice(0, 4)
				.map((m) => m.content)
		]
			.join('\n')
			.toLowerCase()
			.slice(0, 12000);

		const hits = this.aiCharacters
			.filter((c) => c.name.trim().length >= 3 && sample.includes(c.name.trim().toLowerCase()))
			.sort((a, b) => b.name.length - a.name.length);

		return hits[0]?.id;
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
