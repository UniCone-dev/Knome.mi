/**
 * messengerStore - state and helpers for the Messenger layout (a chat-app style
 * way to use Knome: contacts = characters, each with their own saved chats).
 *
 * It owns no data of its own: chats live in conversationsStore, characters in
 * charactersStore. This store only derives "chats of this contact", caches the
 * last-message preview of each chat, and holds a little UI state.
 */

import { DatabaseService } from '$lib/services/database.service';
import { conversationsStore } from '$lib/stores/conversations/index.svelte';

/** Pseudo-contact that collects chats made before characters were tracked per chat. */
export const GENERAL_CONTACT_ID = 'general';

interface Preview {
	/** conversation.lastModified the text was read at: a change means "reload" */
	stamp: number;
	text: string;
	role: string;
}

function tidy(content: string): string {
	return content
		.replace(/```[\s\S]*?```/g, ' [code] ')
		.replace(/[*_`>#~]+/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 90);
}

/** WhatsApp-style time: today -> 14:05, yesterday, weekday this week, else date. */
export function formatChatTime(ts: number | undefined): string {
	if (!ts) return '';

	const d = new Date(ts);
	const now = new Date();
	const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);

	if (days <= 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	if (days === 1) return 'Yesterday';
	if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });

	return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface ContactRef {
	id: string;
	name: string;
	url?: string;
	kind?: 'image' | 'gif' | 'video';
	/** the character card, absent for the "General chats" pseudo-contact */
	character?: DatabaseCharacter;
	general?: boolean;
}

/**
 * Who the open chat is with. In Messenger layout that is the chat's own character (or the
 * General chats contact for older untagged chats); otherwise it is the active character.
 */
export function resolveContact(
	conv: DatabaseConversation | null,
	characters: DatabaseCharacter[],
	activeCharacterId: string | undefined,
	messenger: boolean
): ContactRef | undefined {
	if (messenger && conv && !conv.characterId) {
		return { general: true, id: GENERAL_CONTACT_ID, name: 'General chats' };
	}

	const id = messenger && conv?.characterId ? conv.characterId : activeCharacterId;
	const ch = characters.find((c) => c.id === id);

	return ch
		? { character: ch, id: ch.id, kind: ch.avatarKind, name: ch.name, url: ch.avatarUrl }
		: undefined;
}

class MessengerStore {
	/** The contact-info panel (opened from the chat header). */
	infoOpen = $state(false);

	/** Asks the sidebar to open the Characters dialog (it owns that dialog). */
	charactersDialogRequested = $state(false);

	/** Auto-open the latest chat of the active character only once per page load. */
	autoOpened = false;

	/** Last-message preview per conversation id. */
	private previews = $state<Record<string, Preview>>({});
	private inflight = new Set<string>();

	openInfo(): void {
		this.infoOpen = true;
	}

	closeInfo(): void {
		this.infoOpen = false;
	}

	requestCharactersDialog(): void {
		this.charactersDialogRequested = true;
	}

	/** Chats with one character (or the untagged ones for the general contact), newest first. */
	chatsFor(contactId: string | undefined): DatabaseConversation[] {
		const all = conversationsStore.conversations.filter(
			(c) => !c.hidden || conversationsStore.showHidden
		);
		const list =
			contactId === undefined || contactId === GENERAL_CONTACT_ID
				? all.filter((c) => !c.characterId)
				: all.filter((c) => c.characterId === contactId);

		return [...list].sort((a, b) => b.lastModified - a.lastModified);
	}

	/** Preview of the last message of a chat. Reactive; call ensurePreview() from an effect to load it. */
	preview(conv: DatabaseConversation): Preview | undefined {
		return this.previews[conv.id];
	}

	ensurePreview(conv: DatabaseConversation): void {
		const have = this.previews[conv.id];

		if ((have && have.stamp === conv.lastModified) || this.inflight.has(conv.id)) return;
		if (!conv.currNode) return;

		this.inflight.add(conv.id);

		DatabaseService.getMessageById(conv.currNode)
			.then((m) => {
				this.previews[conv.id] = {
					role: m?.role ?? '',
					stamp: conv.lastModified,
					text: m ? tidy(m.content || m.reasoningContent || '') : ''
				};
			})
			.catch(() => {
				this.previews[conv.id] = { role: '', stamp: conv.lastModified, text: '' };
			})
			.finally(() => this.inflight.delete(conv.id));
	}
}

export const messengerStore = new MessengerStore();
