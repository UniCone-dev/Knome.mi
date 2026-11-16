/**
 * LivingPlayer - plays a living character's emotion clips in the right order.
 *
 * It follows ONE wanted state at a time and moves between states like this:
 *   leave the clip that is looping now  -> its END part (once)
 *   enter the wanted state              -> its START part (once), then its LOOP part (repeating)
 * A wanted state may carry a hold time (a feeling shown after the text is done): when it runs out the
 * wanted state becomes idle again. Idle itself is not played here: the stage keeps the idle loop
 * underneath and fades the active clip in and out over it.
 */
import {
	EMOTION_HOLD_DEFAULT_SECONDS,
	EMOTION_STEP_DEFAULT_SECONDS,
	SPEAKING_SUFFIX
} from '$lib/constants';
import type { EmotionClip, EmotionSet } from '$lib/types/database';
import { emotionHasMedia } from '$lib/utils/emotion-media';

export type LivingTarget =
	| { kind: 'idle' }
	| { kind: 'thinking' }
	| { kind: 'speaking'; emotion?: string }
	| { kind: 'feeling'; emotion: string };

interface Resolved {
	key: string;
	set: EmotionSet;
	holdMs?: number;
}

export interface ActiveClip {
	id: number;
	clip: EmotionClip;
	loop: boolean;
}

export class LivingPlayer {
	/** The clip on screen right now (null = just the idle loop). */
	active = $state<ActiveClip | null>(null);
	/** Name of what is wanted, for display / tests. */
	label = $state('idle');

	private emotions: Record<string, EmotionSet> = {};
	private want: Resolved | null = null;
	private cur: Resolved | null = null;
	private version = 0;
	private clipCounter = 0;
	private running = false;
	private destroyed = false;
	private wake: (() => void) | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private onceDone: (() => void) | null = null;
	private onceTimer: ReturnType<typeof setTimeout> | null = null;

	setEmotions(emotions: Record<string, EmotionSet> | undefined) {
		this.emotions = emotions ?? {};
	}

	/** Pick the best set that has media for a target, falling back step by step. */
	resolve(target: LivingTarget): Resolved | null {
		const has = (k: string) => (emotionHasMedia(this.emotions[k]) ? this.emotions[k] : undefined);

		if (target.kind === 'idle') return null;

		if (target.kind === 'thinking') {
			const s = has('thinking');

			return s ? { key: 'thinking', set: s } : null;
		}

		const e = target.emotion?.toLowerCase() ?? '';

		if (target.kind === 'speaking') {
			const keys = [e ? e + SPEAKING_SUFFIX : '', 'speaking', e].filter(Boolean);

			for (const k of keys) {
				const s = has(k);

				if (s) return { key: k, set: s };
			}

			return null;
		}

		// feeling: shown for its hold time after the text is done
		if (!e) return null;

		const keys = [e, e + SPEAKING_SUFFIX];

		for (const k of keys) {
			const s = has(k);

			if (s) {
				return { key: k, set: s, holdMs: (s.holdSeconds ?? EMOTION_HOLD_DEFAULT_SECONDS) * 1000 };
			}
		}

		return null;
	}

	setTarget(target: LivingTarget) {
		const next = this.resolve(target);
		const sameKey = (next?.key ?? null) === (this.want?.key ?? null);

		this.label =
			target.kind === 'idle'
				? 'idle'
				: `${target.kind}${'emotion' in target && target.emotion ? ':' + target.emotion : ''}`;

		// same clip, but now with a hold time (or without): keep playing, just re-time it
		if (sameKey && (next?.holdMs ?? 0) === (this.want?.holdMs ?? 0)) return;

		this.want = next;
		this.version++;
		this.poke();
		void this.run();
	}

	destroy() {
		this.destroyed = true;
		this.want = null;
		this.version++;
		this.poke();
		this.clearOnce();
		this.active = null;
	}

	/** Called by the stage when a playing video reaches its end. */
	videoEnded() {
		this.finishOnce();
	}

	private poke() {
		if (this.timer) clearTimeout(this.timer);

		this.timer = null;

		const w = this.wake;

		this.wake = null;
		w?.();
	}

	private clearOnce() {
		if (this.onceTimer) clearTimeout(this.onceTimer);

		this.onceTimer = null;
		this.finishOnce();
	}

	private finishOnce() {
		if (this.onceTimer) clearTimeout(this.onceTimer);

		this.onceTimer = null;

		const d = this.onceDone;

		this.onceDone = null;
		d?.();
	}

	private show(clip: EmotionClip, loop: boolean) {
		this.active = { id: ++this.clipCounter, clip, loop };
	}

	/** Play a start / end part once and wait for it to finish. */
	private once(clip: EmotionClip, set: EmotionSet): Promise<void> {
		return new Promise((resolve) => {
			this.show(clip, false);
			this.onceDone = resolve;

			const seconds =
				clip.kind === 'video' ? 30 : (set.stepSeconds ?? EMOTION_STEP_DEFAULT_SECONDS);

			this.onceTimer = setTimeout(() => this.finishOnce(), seconds * 1000);
		});
	}

	/** Wait until the wanted state changes (or `ms` pass). */
	private waitChange(ms?: number): Promise<void> {
		return new Promise((resolve) => {
			this.wake = resolve;

			if (ms !== undefined) this.timer = setTimeout(() => this.poke(), ms);
		});
	}

	private async run() {
		if (this.running) return;

		this.running = true;

		try {
			while (!this.destroyed) {
				const want = this.want;
				const cur = this.cur;

				if (cur && cur.key !== want?.key) {
					// leave: the end part, then back to the idle loop
					this.cur = null;

					if (cur.set.end) await this.once(cur.set.end, cur.set);

					if (this.want?.key !== want?.key || !this.want) this.active = null;

					continue;
				}

				if (want && !cur) {
					this.cur = want;

					if (want.set.start) await this.once(want.set.start, want.set);

					// the wanted state may have changed while the start part played: leave through the end part
					if (this.want?.key !== want.key) continue;

					if (want.set.loop) this.show(want.set.loop, true);
					else this.active = null;

					continue;
				}

				if (!want && !cur) {
					this.active = null;

					break;
				}

				// steady: the loop plays until something changes, or the hold time ends
				const v = this.version;

				await this.waitChange(want?.holdMs);

				if (this.version === v && want?.holdMs !== undefined && this.want === want) {
					this.want = null;
					this.version++;
					this.label = 'idle';
				}
			}
		} finally {
			this.running = false;

			// something may have changed right as the loop ended
			if (!this.destroyed && (this.want?.key ?? null) !== (this.cur?.key ?? null)) void this.run();
		}
	}
}
