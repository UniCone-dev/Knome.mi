/**
 * memoryStore - things the AI should remember about the user ("My memory").
 *
 * Kept in this browser (localStorage), visible and editable in Settings > Profile > Memory,
 * and added to every request when "Use memory" is on. Can be exported / imported as JSON.
 */
import { browser } from '$app/environment';

const KEY = 'Knome.memory';
const ENABLED_KEY = 'Knome.memoryEnabled';
/** keep the prompt small: only the newest items that fit are sent */
const MAX_PROMPT_CHARS = 3000;

export interface MemoryItem {
	id: string;
	text: string;
	createdAt: number;
	updatedAt: number;
}

function readItems(): MemoryItem[] {
	if (!browser) return [];

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');

		return Array.isArray(v) ? v.filter((m) => m && typeof m.text === 'string') : [];
	} catch {
		return [];
	}
}

class MemoryStore {
	items = $state<MemoryItem[]>(readItems());
	enabled = $state(browser ? localStorage.getItem(ENABLED_KEY) !== '0' : true);

	private save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.items));
		} catch {
			/* storage unavailable */
		}
	}

	setEnabled(on: boolean) {
		this.enabled = on;

		try {
			localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
		} catch {
			/* storage unavailable */
		}
	}

	add(text: string): boolean {
		const t = text.trim();

		if (!t || this.items.some((m) => m.text.toLowerCase() === t.toLowerCase())) return false;

		const now = Date.now();

		this.items = [
			{ id: crypto.randomUUID(), text: t, createdAt: now, updatedAt: now },
			...this.items
		];
		this.save();

		return true;
	}

	update(id: string, text: string) {
		const t = text.trim();

		if (!t) return this.remove(id);

		this.items = this.items.map((m) =>
			m.id === id ? { ...m, text: t, updatedAt: Date.now() } : m
		);
		this.save();
	}

	remove(id: string) {
		this.items = this.items.filter((m) => m.id !== id);
		this.save();
	}

	clear() {
		this.items = [];
		this.save();
	}

	/** Text added to the system message, or '' when memory is off / empty. */
	buildPromptBlock(): string {
		if (!this.enabled || this.items.length === 0) return '';

		const lines: string[] = [];
		let used = 0;

		for (const m of this.items) {
			if (used + m.text.length > MAX_PROMPT_CHARS) break;

			lines.push(`- ${m.text}`);
			used += m.text.length;
		}

		return (
			'Things you remember about the user (saved by them; use them naturally when they matter, ' +
			'do not list them back unless asked):\n' +
			lines.join('\n')
		);
	}

	exportData() {
		return { knomeMemory: 1, exportedAt: new Date().toISOString(), items: this.items };
	}

	/** Merge items from an export; returns how many were new. */
	importData(data: unknown): number {
		const list = Array.isArray(data)
			? data
			: data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
				? (data as { items: unknown[] }).items
				: [];
		let added = 0;

		for (const raw of list.slice().reverse()) {
			const text = typeof raw === 'string' ? raw : (raw as { text?: unknown })?.text;

			if (typeof text === 'string' && this.add(text)) added++;
		}

		return added;
	}
}

export const memoryStore = new MemoryStore();
