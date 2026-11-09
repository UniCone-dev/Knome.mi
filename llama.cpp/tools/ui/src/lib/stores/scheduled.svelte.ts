/**
 * scheduledStore - messages to send later ("Scheduled" in the + menu).
 *
 * Everything runs in the browser: a message is sent when its time arrives AND Knome is open.
 * If Knome was closed at the time, the message is shown as "Missed" and can be sent or removed
 * by hand -- it is never sent silently after the fact. Kept in localStorage, per browser.
 */
import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { RouterService } from '$lib/services/router.service';
import { chatStore, conversationsStore } from '$lib/stores';

export type ScheduledStatus = 'pending' | 'sent' | 'missed';

export interface ScheduledMessage {
	id: string;
	text: string;
	/** when to send, ms since epoch */
	at: number;
	/** chat to send it in; undefined = a brand-new chat */
	convId?: string;
	createdAt: number;
	status: ScheduledStatus;
}

const STORAGE_KEY = 'Knome.scheduled';
/** a message that is more than this late when Knome opens counts as missed */
const GRACE_MS = 2 * 60_000;

function load(): ScheduledMessage[] {
	if (!browser) return [];

	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');

		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}

class ScheduledStore {
	items = $state<ScheduledMessage[]>(load());
	dialogOpen = $state(false);
	/** text prefilled into the dialog (taken from the message box when it is opened) */
	draft = $state('');

	private timer: ReturnType<typeof setInterval> | null = null;
	private firing = false;

	get pending(): ScheduledMessage[] {
		return this.items.filter((m) => m.status === 'pending').sort((a, b) => a.at - b.at);
	}

	get pendingCount(): number {
		return this.items.filter((m) => m.status === 'pending' || m.status === 'missed').length;
	}

	private save() {
		if (!browser) return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
		} catch {
			/* storage full or unavailable */
		}
	}

	openDialog(prefill?: string) {
		this.draft = prefill ?? '';
		this.dialogOpen = true;
	}

	add(text: string, at: number, convId?: string): void {
		const msg: ScheduledMessage = {
			id: crypto.randomUUID(),
			text: text.trim(),
			at,
			convId,
			createdAt: Date.now(),
			status: 'pending'
		};

		this.items = [...this.items, msg];
		this.save();
	}

	remove(id: string): void {
		this.items = this.items.filter((m) => m.id !== id);
		this.save();
	}

	clearFinished(): void {
		this.items = this.items.filter((m) => m.status === 'pending');
		this.save();
	}

	/** Start the once-every-few-seconds check. Call once from the root layout. */
	start(): () => void {
		const now = Date.now();
		let changed = false;

		// messages that came due while Knome was closed are "missed", not sent
		for (const m of this.items) {
			if (m.status === 'pending' && m.at < now - GRACE_MS) {
				m.status = 'missed';
				changed = true;
			}
		}

		if (changed) {
			this.items = [...this.items];
			this.save();
		}

		this.timer = setInterval(() => void this.tick(), 5000);
		void this.tick();

		return () => {
			if (this.timer) clearInterval(this.timer);
			this.timer = null;
		};
	}

	private async tick() {
		if (this.firing) return;

		const due = this.pending.find((m) => m.at <= Date.now());

		if (!due) return;

		// wait for the current reply to finish instead of interrupting it
		if (chatStore.isLoading || chatStore.isStreaming()) return;

		await this.sendNow(due.id);
	}

	/** Send a scheduled (or missed) message right now. */
	async sendNow(id: string): Promise<void> {
		const msg = this.items.find((m) => m.id === id);

		if (!msg || this.firing) return;

		this.firing = true;
		// mark first: a failure must never turn into a duplicate send
		msg.status = 'sent';
		this.items = [...this.items];
		this.save();

		try {
			const exists =
				msg.convId && conversationsStore.conversations.some((c) => c.id === msg.convId);

			if (exists && msg.convId) {
				await goto(RouterService.chat(msg.convId));

				for (let i = 0; i < 30; i++) {
					if (conversationsStore.activeConversation?.id === msg.convId) break;

					await new Promise((r) => setTimeout(r, 100));
				}
			} else {
				await conversationsStore.openNewChat();
			}

			await chatStore.sendMessage(msg.text);
		} catch (error) {
			console.error('[Scheduled] failed to send', error);
		} finally {
			this.firing = false;
		}
	}
}

export const scheduledStore = new ScheduledStore();
