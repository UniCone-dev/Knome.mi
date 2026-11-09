<script lang="ts">
	import { ImagePlus, Film, X } from '@lucide/svelte';
	import { imageGenStore } from '$lib/stores/imagegen.svelte';

	let { disabled = false }: { disabled?: boolean } = $props();

	const kind = $derived(imageGenStore.armed);
</script>

{#if kind}
	<button
		aria-label="Turn off create {kind}"
		class="cf-image inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-sm text-primary transition-colors hover:bg-primary/20"
		data-testid="imagegen-armed"
		{disabled}
		onclick={() => imageGenStore.disarm()}
		title="Create {kind} is on - click to turn off"
		type="button"
	>
		{#if kind === 'video'}
			<Film class="h-4 w-4" />
		{:else}
			<ImagePlus class="h-4 w-4" />
		{/if}

		<span>{kind === 'video' ? 'Video' : 'Image'}</span>

		<X class="h-3.5 w-3.5 opacity-70" />
	</button>
{/if}
