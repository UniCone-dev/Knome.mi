/**
 * continuityStore - Knome Context Continuity Engine.
 *
 * When a chat's context is nearly full the model starts to forget. This store watches the context
 * usage and, at a threshold, hands the chat over to a NEW chat:
 *
 *   old chat  ->  summary (rolling, updated by the local model)  +  last messages word for word
 *             ->  new chat linked to the old one (same character, same project, same tools)
 *
 * Modes (Settings > Profile > Context continuity):
 *   auto    (default)  starts the handoff by itself when the threshold is reached
 *   manual             shows a "Continue in new context" button at the threshold
 *   off                nothing happens (llama.cpp's normal context shifting still applies)
 *
 * Safe by design: the old chat is never changed or deleted. If summarizing fails, nothing happens
 * except a message with a Retry button.
 */
import { browser } from '$app/environment';
import { API_CHAT } from '$lib/constants/api-endpoints.constants';
import { contextStatsStore } from '$lib/stores/chat/context-stats.svelte';
import { chatStore } from '$lib/stores/chat/index.svelte';
import { conversationsStore } from '$lib/stores/conversations/index.svelte';
import { modelsStore } from '$lib/stores/models/index.svelte';
import { apiFetch } from '$lib/utils/api-fetch';
import { SvelteSet } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';

const KEY = 'Knome.continuity';

export type ContinuityMode = 'auto' | 'manual' | 'off';

export interface ContinuityConfig {
	mode: ContinuityMode;
	/** context usage (%) that starts / offers the handoff */
	threshold: number;
	/** how many of the last messages are carried over word for word */
	recentCount: number;
	/** the older helper: at 90% the AI saves a chat summary to memory (recall it with @chat "Name") */
	saveSummary: boolean;
}

const DEFAULTS: ContinuityConfig = {
	mode: 'auto',
	recentCount: 4,
	saveSummary: true,
	threshold: 90
};
const MAX_MSG_CHARS = 6000;
const MAX_RECENT_CHARS = 1200;
const MAX_SUMMARY_CHARS = 6000;

function readConfig(): ContinuityConfig {
	if (!browser) return { ...DEFAULTS };

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');

		return sanitize({ ...DEFAULTS, ...(v && typeof v === 'object' ? v : {}) });
	} catch {
		return { ...DEFAULTS };
	}
}

export function sanitize(c: Partial<ContinuityConfig>): ContinuityConfig {
	const mode: ContinuityMode = c.mode === 'manual' || c.mode === 'off' ? c.mode : 'auto';
	const th = Number(c.threshold);
	const rc = Number(c.recentCount);

	return {
		mode,
		recentCount: Number.isFinite(rc)
			? Math.min(10, Math.max(0, Math.round(rc)))
			: DEFAULTS.recentCount,
		saveSummary: c.saveSummary === false ? false : true,
		threshold: Number.isFinite(th) ? Math.min(98, Math.max(50, Math.round(th))) : DEFAULTS.threshold
	};
}

export interface TranscriptLine {
	role: 'user' | 'assistant';
	text: string;
}

/** The readable part of a chat: user and assistant words, with short notes for pictures and tools. */
export function buildTranscript(
	messages: {
		role: string;
		content?: string;
		toolCalls?: string;
		extra?: { type?: string; name?: string }[];
		isSynthetic?: boolean;
	}[]
): TranscriptLine[] {
	const out: TranscriptLine[] = [];

	let skipReply = false;

	for (const m of messages) {
		if (m.role !== 'user' && m.role !== 'assistant') continue;

		if (m.isSynthetic) continue;

		// the older auto-summary helper's own request is not part of the conversation
		if (m.role === 'user' && (m.content ?? '').startsWith('[System: context is almost full]')) {
			skipReply = true;

			continue;
		}

		if (m.role === 'assistant' && skipReply) {
			// its answer (and tool calls) belong to that request too; the next user message ends it
			continue;
		}

		if (m.role === 'user') skipReply = false;

		const parts: string[] = [];

		let text = (m.content ?? '')
			.replace(/<think>[\s\S]*?<\/think>/gi, '')
			.replace(/\[emo:[^\]]*\]/gi, '')
			.trim();

		if (text.length > MAX_MSG_CHARS) text = text.slice(0, MAX_MSG_CHARS) + ' [...]';

		if (text) parts.push(text);

		for (const e of m.extra ?? []) {
			if (e.type === 'IMAGE') parts.push(`[picture${e.name ? ': ' + e.name : ''}]`);
			else if (e.type === 'VIDEO') parts.push('[video]');
			else if (e.name) parts.push(`[file: ${e.name}]`);
		}

		if (m.role === 'assistant' && m.toolCalls) {
			try {
				const calls = JSON.parse(m.toolCalls) as { function?: { name?: string } }[];
				const names = calls
					.map((c) => c.function?.name)
					.filter((n, i, all): n is string => !!n && all.indexOf(n) === i);

				if (names.length) parts.push(`[used tools: ${names.join(', ')}]`);
			} catch {
				/* not JSON: ignore */
			}
		}

		if (parts.length) out.push({ role: m.role, text: parts.join('\n') });
	}

	return out;
}

/** Cuts a transcript into pieces that each fit `maxChars` (a single huge message is cut, never dropped). */
export function chunkTranscript(lines: TranscriptLine[], maxChars: number): string[] {
	const chunks: string[] = [];

	let cur = '';

	for (const l of lines) {
		let piece = `${l.role === 'user' ? 'User' : 'Assistant'}: ${l.text}\n\n`;

		if (piece.length > maxChars) piece = piece.slice(0, maxChars - 8) + ' [...]\n\n';

		if (cur.length + piece.length > maxChars && cur) {
			chunks.push(cur);
			cur = '';
		}

		cur += piece;
	}

	if (cur.trim()) chunks.push(cur);

	return chunks;
}

const SUMMARY_SYSTEM = [
	'You write a HANDOFF SUMMARY so a new chat can continue an earlier chat without losing anything important.',
	'Write in the same language the conversation uses. Output ONLY the summary, using these headings (leave out empty ones):',
	'Goal - what the user is trying to do overall.',
	'Decisions - what was decided or chosen, and why.',
	'Progress - what is already done or answered.',
	'Open tasks - what is still pending or was promised.',
	'About the user - facts and preferences the user stated.',
	'Important details - exact names, numbers, file paths, commands, code snippets, settings, URLs worth keeping.',
	'Tone and persona - how the assistant was talking (character, style, language mix), so the new chat sounds the same.',
	'Be compact but never drop a concrete detail that would be needed to carry on. Do not invent anything.',
	'If a PREVIOUS SUMMARY is given, UPDATE it: keep what is still true, add the new information, remove what became obsolete.'
].join('\n');

function stripThink(t: string): string {
	return t
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/<think>[\s\S]*$/i, '')
		.trim();
}

class ContinuityStore {
	config = $state<ContinuityConfig>(readConfig());
	error = $state('');
	status = $state<'idle' | 'working' | 'error'>('idle');
	step = $state('');
	/** chats the user closed the banner for (or that already failed once in auto mode) */
	private dismissed = new SvelteSet<string>();
	private running = false;

	/** true when this chat has reached the threshold and a handoff makes sense */
	get due(): boolean {
		const p = this.percent;
		const conv = conversationsStore.activeConversation;

		return (
			this.config.mode !== 'off' &&
			p !== null &&
			p >= this.config.threshold &&
			!!conv &&
			conversationsStore.activeMessages.length >= 2 &&
			!chatStore.isLoading
		);
	}

	get mode(): ContinuityMode {
		return this.config.mode;
	}

	get percent(): number | null {
		return contextStatsStore.contextPercent;
	}

	/** Extra text for the model in a chat that continues an earlier one. '' for every other chat. */
	buildPromptBlock(): string {
		const h = conversationsStore.activeConversation?.handoff;

		if (!h || !h.summary) return '';

		const lines = [
			`## Continuing an earlier chat`,
			`This chat carries on from "${h.fromName}", whose context was full. The handoff below is your memory of it: continue naturally, keep the same persona and language, and do not mention the handoff unless the user asks.`,
			'',
			'### Summary',
			h.summary
		];

		if (h.recent?.length) {
			lines.push('', '### Last messages of the earlier chat (word for word)');

			for (const r of h.recent)
				lines.push(`${r.role === 'user' ? 'User' : 'Assistant'}: ${r.text}`);
		}

		return lines.join('\n');
	}

	dismiss(id: string): void {
		this.dismissed.add(id);

		if (this.status === 'error') this.status = 'idle';
	}

	isDismissed(id: string): boolean {
		return this.dismissed.has(id);
	}

	/** auto mode: called when a reply has just finished */
	async maybeAutoRun(): Promise<void> {
		if (this.config.mode !== 'auto' || this.running) return;

		// the reply's token counts are saved a moment after it ends
		await new Promise((r) => setTimeout(r, 900));

		const conv = conversationsStore.activeConversation;

		if (!conv || this.dismissed.has(conv.id) || !this.due) return;

		await this.run();
	}

	/** Builds the handoff and opens the new chat. Used by auto mode and by the manual button. */
	async run(): Promise<void> {
		const conv = conversationsStore.activeConversation;

		if (!conv || this.running) return;

		this.running = true;
		this.status = 'working';
		this.error = '';
		this.step = 'Reading the chat ...';

		const percent = this.percent ?? undefined;

		try {
			const lines = buildTranscript(conversationsStore.activeMessages);

			if (lines.length < 2) throw new Error('This chat is too short to summarize.');

			const modelId = modelsStore.activeModelId;
			const ctx = contextStatsStore.contextTotal ?? 8192;
			// the summarizer request must fit the context too: small pieces, rolled one into the next
			const chunkChars = Math.floor(Math.max(600, Math.min(12000, ctx * 0.3)) * 3.2);
			const maxOut = Math.floor(Math.max(300, Math.min(1200, ctx * 0.25)));
			const prev = conv.handoff;
			const chunks = chunkTranscript(lines, chunkChars);

			let summary = prev?.summary ?? '';

			for (let i = 0; i < chunks.length; i++) {
				this.step =
					chunks.length > 1
						? `Summarizing part ${i + 1} of ${chunks.length} ...`
						: 'Summarizing ...';
				summary = await this.summarize(modelId, summary, chunks[i], maxOut);
			}

			if (!summary.trim()) throw new Error('The model returned an empty summary.');

			if (summary.length > MAX_SUMMARY_CHARS)
				summary = summary.slice(0, MAX_SUMMARY_CHARS) + ' [...]';

			const recent = lines.slice(-this.config.recentCount).map((l) => ({
				role: l.role,
				text:
					l.text.length > MAX_RECENT_CHARS ? l.text.slice(0, MAX_RECENT_CHARS) + ' [...]' : l.text
			}));

			this.step = 'Opening the new chat ...';

			await conversationsStore.createContinuation(conv, {
				createdAt: Date.now(),
				fromId: conv.id,
				fromName: conv.name,
				percent,
				recent,
				summary,
				version: (prev?.version ?? 0) + 1
			});

			this.status = 'idle';
			toast.success('Continued in a new chat. Your context is fresh again.');
		} catch (e) {
			// the old chat is untouched; the user can retry or just keep going
			this.status = 'error';
			this.error = e instanceof Error ? e.message : String(e);
			this.dismissed.add(conv.id);
			console.error('[continuity]', e);
		} finally {
			this.running = false;
		}
	}

	update(patch: Partial<ContinuityConfig>): void {
		this.config = sanitize({ ...this.config, ...patch });

		try {
			localStorage.setItem(KEY, JSON.stringify(this.config));
		} catch {
			/* storage unavailable */
		}
	}

	private async summarize(
		model: string | null,
		previous: string,
		chunk: string,
		maxTokens: number
	): Promise<string> {
		const user = [
			previous ? `PREVIOUS SUMMARY:\n${previous}\n` : '',
			'NEW PART OF THE CONVERSATION:\n' + chunk,
			'\nWrite the updated handoff summary now.'
		].join('\n');
		const res = await apiFetch<{ choices?: { message?: { content?: string } }[] }>(
			API_CHAT.COMPLETIONS,
			{
				body: JSON.stringify({
					...(model ? { model } : {}),
					chat_template_kwargs: { enable_thinking: false },
					max_tokens: maxTokens,
					messages: [
						{ content: SUMMARY_SYSTEM, role: 'system' },
						{ content: user, role: 'user' }
					],
					stream: false,
					temperature: 0.2
				}),
				method: 'POST'
			}
		);

		return stripThink(res.choices?.[0]?.message?.content ?? '');
	}
}

export const continuityStore = new ContinuityStore();
