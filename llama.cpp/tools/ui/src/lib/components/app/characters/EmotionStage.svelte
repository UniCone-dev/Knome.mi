<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		EMOTION_HOLD_DEFAULT_SECONDS,
		EMOTION_STEP_DEFAULT_SECONDS
	} from '$lib/constants';
	import type { EmotionClip, EmotionSet } from '$lib/types/database';
	import { BlobUrls } from '$lib/utils/emotion-media';

	interface Props {
		/** The emotion to play: start (once), loop (for holdSeconds), end (once). */
		set?: EmotionSet;
		/** Plays underneath and again when the emotion is over. */
		idle?: EmotionSet;
		/** Change this number to play `set` once from the beginning. */
		playId?: number;
		/** Keep the loop part going until `playId` changes again (no hold timer, no end part). */
		hold?: boolean;
		class?: string;
	}

	let { set, idle, playId = 0, hold = false, class: className = '' }: Props = $props();

	const urls = new BlobUrls();

	let active = $state<{ id: number; clip: EmotionClip; loop: boolean } | null>(null);
	let runToken = 0;
	let clipCounter = 0;
	let wake: (() => void) | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function finish() {
		if (timer) clearTimeout(timer);

		timer = null;

		const w = wake;

		wake = null;
		w?.();
	}

	/** Show a clip and wait until it is over (video: its end, or the time for stills / loops). */
	function show(clip: EmotionClip, loop: boolean, seconds: number, token: number): Promise<void> {
		return new Promise((resolve) => {
			if (token !== runToken) return resolve();

			active = { id: ++clipCounter, clip, loop };
			wake = resolve;

			const isVideoOnce = clip.kind === 'video' && !loop;

			// a video that plays once ends by itself; give it a safety limit
			timer = setTimeout(finish, (isVideoOnce ? 30 : seconds) * 1000);
		});
	}

	async function run(token: number) {
		if (!set) return;

		const step = set.stepSeconds ?? EMOTION_STEP_DEFAULT_SECONDS;
		const holdFor = set.holdSeconds ?? EMOTION_HOLD_DEFAULT_SECONDS;

		if (set.start) await show(set.start, false, step, token);

		if (token !== runToken) return;

		if (set.loop) await show(set.loop, true, hold ? 86400 : holdFor, token);

		if (token !== runToken || hold) return;

		if (set.end) await show(set.end, false, step, token);

		if (token === runToken) active = null;
	}

	$effect(() => {
		// restart whenever playId changes
		void playId;

		finish();

		const token = ++runToken;

		active = null;

		if (playId > 0) void run(token);
	});

	onDestroy(() => {
		runToken++;
		finish();
		urls.revokeAll();
	});
</script>

<div class="relative h-full w-full overflow-hidden bg-muted {className}">
	{#if idle?.loop}
		{@const c = idle.loop}
		{#if c.kind === 'video'}
			<video autoplay class="absolute inset-0 h-full w-full object-cover" loop muted playsinline src={urls.get(c.blob)}
			></video>
		{:else}
			<img alt="" class="absolute inset-0 h-full w-full object-cover" src={urls.get(c.blob)} />
		{/if}
	{/if}

	{#if active}
		{#key active.id}
			<div class="absolute inset-0" in:fade={{ duration: 220 }} out:fade={{ duration: 220 }}>
				{#if active.clip.kind === 'video'}
					<video
						autoplay
						class="h-full w-full object-cover"
						loop={active.loop}
						muted
						onended={finish}
						playsinline
						src={urls.get(active.clip.blob)}
					></video>
				{:else}
					<img alt="" class="h-full w-full object-cover" src={urls.get(active.clip.blob)} />
				{/if}
			</div>
		{/key}
	{/if}
</div>
