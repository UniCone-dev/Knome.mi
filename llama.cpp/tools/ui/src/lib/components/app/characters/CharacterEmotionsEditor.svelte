<script lang="ts">
	import { ArrowLeft, Play, Plus, Trash2, Upload, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		CORE_EMOTION_STATES,
		EMOTION_ACCEPT,
		EMOTION_HOLD_DEFAULT_SECONDS,
		EMOTION_HOLD_MAX_SECONDS,
		EMOTION_HOLD_MIN_SECONDS,
		EMOTION_STEP_DEFAULT_SECONDS,
		FEELING_STATES,
		SPEAKING_SUFFIX,
		baseEmotionKey,
		isSpeakingKey,
		normalizeEmotionName
	} from '$lib/constants';
	import { charactersStore } from '$lib/stores';
	import type { DatabaseCharacter, EmotionClip, EmotionSet } from '$lib/types/database';
	import { BlobUrls, emotionHasMedia } from '$lib/utils/emotion-media';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import EmotionStage from './EmotionStage.svelte';

	interface Props {
		character: DatabaseCharacter;
		onBack: () => void;
	}

	let { character, onBack }: Props = $props();

	const urls = new BlobUrls();

	let root = $state<HTMLDivElement | null>(null);

	// the editor was opened from the bottom of a scrolled form: start at the top
	onMount(() => {
		for (let el = root?.parentElement; el; el = el.parentElement) {
			if (el.scrollTop > 0) el.scrollTop = 0;
		}
	});

	onDestroy(() => urls.revokeAll());

	// always read the saved character: every change is stored at once
	let live = $derived(charactersStore.getCharacter(character.id) ?? character);
	let emotions = $derived(live.emotions ?? {});

	let selected = $state('idle');
	let search = $state('');
	let customName = $state('');
	let playId = $state(0);
	let mode = $derived<'feeling' | 'speaking'>(isSpeakingKey(selected) ? 'speaking' : 'feeling');
	let base = $derived(baseEmotionKey(selected));
	let isCore = $derived(CORE_EMOTION_STATES.some((s) => s.key === selected));

	let customKeys = $derived(
		[
			...new Set(
				Object.keys(emotions)
					.map(baseEmotionKey)
					.filter(
						(k) =>
							!CORE_EMOTION_STATES.some((s) => s.key === k) &&
							!FEELING_STATES.some((s) => s.key === k)
					)
			)
		].sort()
	);

	let allFeelings = $derived([
		...FEELING_STATES,
		...customKeys.map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))
	]);

	let visibleFeelings = $derived(
		allFeelings.filter(
			(s) => !search.trim() || s.label.toLowerCase().includes(search.trim().toLowerCase())
		)
	);

	let filledCount = $derived(
		(Object.values(emotions) as EmotionSet[]).filter((e) => emotionHasMedia(e)).length
	);
	let current = $derived(emotions[selected]);

	let slots = $derived.by(() => {
		if (selected === 'idle') {
			return [
				{
					slot: 'loop' as const,
					title: 'Idle loop',
					help: 'Resting. Make the last frame match the first so it repeats without a cut.'
				}
			];
		}

		if (selected === 'thinking') {
			return [
				{ slot: 'start' as const, title: '1 · Start', help: 'Idle to thinking. Plays once.' },
				{
					slot: 'loop' as const,
					title: '2 · Thinking loop',
					help: 'Plays while the AI thinks, seamless.'
				},
				{
					slot: 'end' as const,
					title: '3 · End → speaking',
					help: 'Thinking to the moment it starts to answer. Plays once.'
				}
			];
		}

		return [
			{ slot: 'start' as const, title: '1 · Start', help: 'Idle to this emotion. Plays once.' },
			{
				slot: 'loop' as const,
				title: '2 · Loop',
				help: 'The emotion itself, seamless. Plays as long as it is needed.'
			},
			{ slot: 'end' as const, title: '3 · End', help: 'This emotion back to idle. Plays once.' }
		];
	});

	let showHold = $derived(
		!['idle', 'thinking', 'listening', 'speaking'].includes(selected) && mode === 'feeling'
	);

	function mark(key: string): string {
		const f = emotionHasMedia(emotions[key]);
		const s = emotionHasMedia(emotions[key + SPEAKING_SUFFIX]);

		return f && s ? '●●' : f || s ? '●' : '';
	}

	function pick(key: string) {
		selected = key;
		playId = 0;
	}

	async function onFile(slot: 'start' | 'loop' | 'end', e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		input.value = '';

		if (!file) return;

		const error = await charactersStore.setEmotionClip(character.id, selected, slot, file);

		if (error) toast.error(error);
	}

	function addCustom() {
		const n = normalizeEmotionName(customName);

		if (!n) return;

		selected = n;
		customName = '';
		toast.info(`"${n}" added. Upload a clip to keep it.`);
	}

	function clipUrl(c: EmotionClip) {
		return urls.get(c.blob);
	}
</script>

<div bind:this={root} class="flex flex-col gap-4">
	<div class="flex items-center gap-2">
		<Button aria-label="Back" onclick={onBack} size="icon" variant="ghost">
			<ArrowLeft class="h-4 w-4" />
		</Button>

		<div class="min-w-0 flex-1">
			<h3 class="truncate text-base font-semibold">Living emotions · {live.name}</h3>
			<p class="text-xs text-muted-foreground">
				{filledCount} states have media. Everything is saved the moment you add it.
			</p>
		</div>
	</div>

	<p class="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
		Every emotion has 3 parts: <strong>Start</strong> (idle to the emotion), <strong>Loop</strong>
		(the emotion, seamless) and <strong>End</strong> (back to idle). Use mp4, webm, gif or png. The live
		player that uses these comes in the next patch; here you can already build and test them.
	</p>

	<div class="grid gap-4 md:grid-cols-[14rem_1fr]">
		<div class="flex min-h-0 flex-col gap-2">
			<p class="text-xs font-semibold text-muted-foreground uppercase">Core</p>

			<div class="flex flex-wrap gap-1.5 md:flex-col">
				{#each CORE_EMOTION_STATES as s (s.key)}
					<button
						class="flex items-center justify-between rounded-md border px-2 py-1 text-left text-sm {selected ===
						s.key
							? 'border-primary bg-accent'
							: 'border-border hover:bg-muted/60'}"
						onclick={() => pick(s.key)}
						type="button"
					>
						{s.label}
						<span class="text-primary">{emotionHasMedia(emotions[s.key]) ? '●' : ''}</span>
					</button>
				{/each}
			</div>

			<p class="mt-2 text-xs font-semibold text-muted-foreground uppercase">Emotions</p>
			<Input bind:value={search} placeholder="Search..." />

			<div class="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
				{#each visibleFeelings as s (s.key)}
					<button
						class="flex items-center justify-between rounded-md border px-2 py-1 text-left text-sm {base ===
							s.key && !CORE_EMOTION_STATES.some((c) => c.key === selected)
							? 'border-primary bg-accent'
							: 'border-border hover:bg-muted/60'}"
						onclick={() => pick(s.key)}
						type="button"
					>
						{s.label}
						<span class="text-primary">{mark(s.key)}</span>
					</button>
				{/each}
			</div>

			<form
				class="flex gap-1.5"
				onsubmit={(e) => {
					e.preventDefault();
					addCustom();
				}}
			>
				<Input bind:value={customName} placeholder="Your own emotion" />
				<Button
					disabled={!normalizeEmotionName(customName)}
					size="icon"
					type="submit"
					variant="outline"
				>
					<Plus class="h-4 w-4" />
				</Button>
			</form>
		</div>

		<div class="flex min-w-0 flex-col gap-3">
			{#if !CORE_EMOTION_STATES.some((s) => s.key === selected)}
				<div class="flex gap-2">
					<Button
						onclick={() => pick(base)}
						size="sm"
						variant={mode === 'feeling' ? 'default' : 'outline'}
					>
						Feeling it
					</Button>
					<Button
						onclick={() => pick(base + SPEAKING_SUFFIX)}
						size="sm"
						variant={mode === 'speaking' ? 'default' : 'outline'}
					>
						Speaking it
					</Button>
				</div>

				<p class="text-xs text-muted-foreground">
					{mode === 'feeling'
						? 'How the character looks while feeling this (reacting, listening).'
						: 'How the character looks while talking with this feeling, for example happily speaking or sadly speaking. Plays for as long as the text is being written.'}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">
					{CORE_EMOTION_STATES.find((s) => s.key === selected)?.hint}
				</p>
			{/if}

			<div class="grid gap-3 sm:grid-cols-3">
				{#each slots as { slot, title, help } (slot)}
					{@const clip = current?.[slot]}
					<div class="flex flex-col gap-1.5 rounded-lg border border-border p-2">
						<p class="text-sm font-medium">{title}</p>

						<div
							class="relative aspect-square overflow-hidden rounded-md border border-dashed border-border bg-muted"
						>
							{#if clip}
								{#if clip.kind === 'video'}
									<video
										autoplay
										class="h-full w-full object-cover"
										loop
										muted
										playsinline
										src={clipUrl(clip)}
									></video>
								{:else}
									<img alt={title} class="h-full w-full object-cover" src={clipUrl(clip)} />
								{/if}

								<button
									aria-label="Remove {title}"
									class="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent"
									onclick={() => charactersStore.removeEmotionClip(character.id, selected, slot)}
									type="button"
								>
									<X class="h-3.5 w-3.5" />
								</button>
							{:else}
								<label
									class="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-accent"
								>
									<Upload class="h-5 w-5" />
									<span class="text-[11px]">mp4 · webm · gif · png</span>
									<input
										accept={EMOTION_ACCEPT}
										class="hidden"
										onchange={(e) => onFile(slot, e)}
										type="file"
									/>
								</label>
							{/if}
						</div>

						<p class="text-[11px] text-muted-foreground">{help}</p>

						{#if clip}
							<label class="cursor-pointer text-[11px] text-primary underline">
								Replace
								<input
									accept={EMOTION_ACCEPT}
									class="hidden"
									onchange={(e) => onFile(slot, e)}
									type="file"
								/>
							</label>
						{/if}
					</div>
				{/each}
			</div>

			{#if showHold}
				<div class="flex items-center gap-3">
					<span class="flex-shrink-0 text-sm">Stays for</span>
					<input
						class="flex-1"
						max={EMOTION_HOLD_MAX_SECONDS}
						min={EMOTION_HOLD_MIN_SECONDS}
						oninput={(e) =>
							charactersStore.setEmotionTiming(character.id, selected, {
								holdSeconds: Number((e.target as HTMLInputElement).value)
							})}
						step="0.5"
						type="range"
						value={current?.holdSeconds ?? EMOTION_HOLD_DEFAULT_SECONDS}
					/>
					<span class="w-12 flex-shrink-0 text-right text-xs text-muted-foreground">
						{current?.holdSeconds ?? EMOTION_HOLD_DEFAULT_SECONDS}s
					</span>
				</div>
			{/if}

			{#if current && [current.start, current.end].some((c) => c && c.kind !== 'video')}
				<div class="flex items-center gap-3">
					<span class="flex-shrink-0 text-sm">Still start / end shows</span>
					<input
						class="flex-1"
						max="5"
						min="0.5"
						oninput={(e) =>
							charactersStore.setEmotionTiming(character.id, selected, {
								stepSeconds: Number((e.target as HTMLInputElement).value)
							})}
						step="0.5"
						type="range"
						value={current.stepSeconds ?? EMOTION_STEP_DEFAULT_SECONDS}
					/>
					<span class="w-12 flex-shrink-0 text-right text-xs text-muted-foreground">
						{current.stepSeconds ?? EMOTION_STEP_DEFAULT_SECONDS}s
					</span>
				</div>
			{/if}

			<div class="flex flex-wrap items-center gap-3">
				<div class="h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl border border-border">
					<EmotionStage idle={emotions.idle} {playId} set={current} />
				</div>

				<div class="flex flex-col gap-2">
					<Button
						disabled={!emotionHasMedia(current)}
						onclick={() => (playId += 1)}
						size="sm"
						variant="secondary"
					>
						<Play class="h-3.5 w-3.5" /> Test: idle → {selected.replace(
							SPEAKING_SUFFIX,
							' speaking'
						)} → idle
					</Button>

					{#if emotionHasMedia(current)}
						<Button
							onclick={() => charactersStore.removeEmotion(character.id, selected)}
							size="sm"
							variant="ghost"
						>
							<Trash2 class="h-3.5 w-3.5" /> Remove all parts of this
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
