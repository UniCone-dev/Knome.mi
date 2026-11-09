<script lang="ts">
	import { Loader2, Check, TriangleAlert } from '@lucide/svelte';
	import { imageGenStore } from '$lib/stores/imagegen.svelte';

	const STEPS = [
		['unloading-text', 'Text model off'],
		['loading-diffusion', 'Image model on'],
		['generating', 'Generating'],
		['unloading-diffusion', 'Image model off'],
		['restoring-text', 'Text model back']
	] as const;

	const stepIndex = $derived(STEPS.findIndex(([k]) => k === imageGenStore.phase));
	const showCard = $derived(imageGenStore.phase !== 'idle');
</script>

{#if showCard}
	<div
		class="fixed right-4 bottom-24 z-50 w-72 rounded-2xl border border-border bg-background/95 p-3 text-sm shadow-xl backdrop-blur"
		data-testid="imagegen-card"
	>
		{#if imageGenStore.phase === 'error'}
			<div class="flex items-start gap-2 text-destructive">
				<TriangleAlert class="mt-0.5 size-4 shrink-0" />
				<span class="text-xs">{imageGenStore.detail}</span>
			</div>
		{:else}
			<div class="mb-2 flex items-center justify-between">
				<span class="font-medium">
					{imageGenStore.kind === 'video' ? 'Making a video' : 'Making an image'}
				</span>

				{#if imageGenStore.busy}
					<button
						class="text-xs text-muted-foreground hover:text-foreground"
						onclick={() => imageGenStore.cancel()}
					>
						Cancel
					</button>
				{/if}
			</div>

			<ul class="space-y-1">
				{#each STEPS as [key, label], i (key)}
					<li
						class="flex items-center gap-2 text-xs {i > stepIndex && imageGenStore.phase !== 'done'
							? 'text-muted-foreground/60'
							: ''}"
					>
						{#if imageGenStore.phase === 'done' || i < stepIndex}
							<Check class="size-3.5 text-primary" />
						{:else if i === stepIndex}
							<Loader2 class="size-3.5 animate-spin text-primary" />
						{:else}
							<span class="size-3.5 rounded-full border border-border"></span>
						{/if}

						<span>{label}</span>
					</li>
				{/each}
			</ul>

			{#if imageGenStore.detail}
				<p class="mt-2 text-xs text-muted-foreground">{imageGenStore.detail}</p>
			{/if}
		{/if}
	</div>
{/if}
