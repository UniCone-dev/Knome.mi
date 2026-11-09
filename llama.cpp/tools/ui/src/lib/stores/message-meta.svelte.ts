/**
 * messageMetaStore - reactions and stars on messages (Messenger layout).
 * Kept in this browser (localStorage), keyed by message id; the chat itself is untouched.
 */
import { browser } from '$app/environment';

const KEY = 'Knome.messageMeta';

export interface MessageMeta {
	reaction?: string;
	starred?: boolean;
}

function read(): Record<string, MessageMeta> {
	if (!browser) return {};

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');

		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}

class MessageMetaStore {
	meta = $state<Record<string, MessageMeta>>(read());

	get(id: string): MessageMeta {
		return this.meta[id] ?? {};
	}

	private patch(id: string, next: MessageMeta) {
		const all = { ...this.meta };

		if (next.reaction || next.starred) all[id] = next;
		else delete all[id];

		this.meta = all;

		try {
			localStorage.setItem(KEY, JSON.stringify(all));
		} catch {
			/* storage unavailable */
		}
	}

	/** same emoji again removes the reaction */
	react(id: string, emoji: string) {
		const cur = this.get(id);

		this.patch(id, { ...cur, reaction: cur.reaction === emoji ? undefined : emoji });
	}

	toggleStar(id: string) {
		const cur = this.get(id);

		this.patch(id, { ...cur, starred: !cur.starred });
	}

	isStarred(id: string): boolean {
		return this.meta[id]?.starred === true;
	}
}

export const messageMetaStore = new MessageMetaStore();

/** Scrolls a message into view and flashes it (same highlight as the Library). */
export function jumpToMessage(messageId: string): boolean {
	const el = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);

	if (!el) return false;

	el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	el.classList.add('library-flash');
	setTimeout(() => el.classList.remove('library-flash'), 2200);

	return true;
}
