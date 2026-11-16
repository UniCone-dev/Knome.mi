<script lang="ts">
	// Older AI messages: the character at rest (first frame of the idle clip), not the profile picture.
	import { onDestroy } from 'svelte';
	import { livingStore } from '$lib/stores/living.svelte';
	import { BlobUrls } from '$lib/utils/emotion-media';

	interface Props {
		fallbackUrl?: string;
	}

	let { fallbackUrl }: Props = $props();

	const urls = new BlobUrls();

	let idle = $derived(livingStore.character?.emotions?.idle?.loop);

	onDestroy(() => urls.revokeAll());
</script>

{#if idle?.kind === 'video'}
	<video
		class="h-full w-full object-cover"
		muted
		playsinline
		preload="metadata"
		src={urls.get(idle.blob)}
	></video>
{:else if idle}
	<img alt="" class="h-full w-full object-cover" src={urls.get(idle.blob)} />
{:else if fallbackUrl}
	<img alt="" class="h-full w-full object-cover" src={fallbackUrl} />
{/if}
