/**
 * commandMemoryStore - shell commands that already worked on THIS computer ("Command memory").
 *
 * Filled automatically when the user allowed a `system` run command and it succeeded, and editable in
 * Settings > Tools. A short list is added to the system message while system control is available, so
 * the model reuses a working command for this Linux distro instead of guessing. Kept in this browser.
 * Saving a command here never lets it run by itself: every run still asks for permission.
 */
import { browser } from '$app/environment';

const KEY = 'Knome.commandMemory';
const ENABLED_KEY = 'Knome.commandMemoryEnabled';
const MAX_PROMPT_CHARS = 2500;
const MAX_ITEMS = 200;

export interface CommandMemoryItem {
	id: string;
	task: string;
	command: string;
	createdAt: number;
	lastUsedAt: number;
	uses: number;
}

function readItems(): CommandMemoryItem[] {
	if (!browser) return [];

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');

		return Array.isArray(v)
			? v.filter((m) => m && typeof m.command === 'string' && typeof m.task === 'string')
			: [];
	} catch {
		return [];
	}
}

class CommandMemoryStore {
	items = $state<CommandMemoryItem[]>(readItems());
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

	/** Save a command that just worked; the same command only bumps its use counter. */
	remember(task: string, command: string): void {
		const c = command.trim();
		const t = task.trim().slice(0, 120) || c.slice(0, 60);

		if (!c || c.length > 1000) return;

		const now = Date.now();
		const existing = this.items.find((m) => m.command === c);

		if (existing) {
			this.items = this.items.map((m) =>
				m.id === existing.id
					? { ...m, task: task.trim() ? t : m.task, uses: m.uses + 1, lastUsedAt: now }
					: m
			);
		} else {
			this.items = [
				{ id: crypto.randomUUID(), task: t, command: c, createdAt: now, lastUsedAt: now, uses: 1 },
				...this.items
			].slice(0, MAX_ITEMS);
		}

		this.save();
	}

	updateTask(id: string, task: string) {
		const t = task.trim();

		if (!t) return;

		this.items = this.items.map((m) => (m.id === id ? { ...m, task: t.slice(0, 120) } : m));
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

	/**
	 * Text for the system message. Only call it while system control is available: it also tells the
	 * model how to learn commands (search the web when unsure, then run, then it is saved).
	 */
	buildPromptBlock(): string {
		const guide =
			'On this computer you can use the `system` tool (the user allows every call). When no ' +
			'specific action fits, use action=run. If you do not know the right command for this ' +
			'Linux distro, search the web first, then run the command. When you use action=run set ' +
			'source to a short description of what the command does (3-8 words): commands that work ' +
			'are saved to the command memory below.';

		if (!this.enabled || this.items.length === 0) return guide;

		const lines: string[] = [];
		let used = 0;

		for (const m of this.items) {
			const line = `- ${m.task}: ${m.command}`;

			if (used + line.length > MAX_PROMPT_CHARS) break;

			lines.push(line);
			used += line.length;
		}

		return `${guide}\n\nCommands that already worked on this computer (reuse them; the user still has to allow each run):\n${lines.join('\n')}`;
	}
}

export const commandMemoryStore = new CommandMemoryStore();
