<script lang="ts">
	// The living picture: the idle loop (or the profile picture) with the playing clip faded over it.
	// It fills its parent, so it works as an avatar or as the floating window.
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { livingStore } from '$lib/stores/living.svelte';
	import { BlobUrls } from '$lib/utils/emotion-media';

	interface Props {
		/** Shown while the character has no idle clip. */
		fallbackUrl?: string;
	}

	let { fallbackUrl }: Props = $props();

	const player = livingStore.player;
	const urls = new BlobUrls();

	let idleLoop = $derived(livingStore.character?.emotions?.idle?.loop);
	let avatar = $derived(fallbackUrl ?? livingStore.character?.avatarUrl);

	onDestroy(() => urls.revokeAll());
</script>

<div class="relative h-full w-full overflow-hidden">
	{#if idleLoop}
		{#if idleLoop.kind === 'video'}
			<video
				autoplay
				class="absolute inset-0 h-full w-full object-cover"
				loop
				muted
				playsinline
				src={urls.get(idleLoop.blob)}
			></video>
		{:else}
			<img
				alt=""
				class="absolute inset-0 h-full w-full object-cover"
				src={urls.get(idleLoop.blob)}
			/>
		{/if}
	{:else if avatar}
		<img
			alt=""
			draggable="false"
			class="absolute inset-0 h-full w-full object-cover"
			src={avatar}
		/>
	{/if}

	{#if player.active}
		{#key player.active.id}
			<div class="absolute inset-0" in:fade={{ duration: 220 }} out:fade={{ duration: 220 }}>
				{#if player.active.clip.kind === 'video'}
					<video
						autoplay
						class="h-full w-full object-cover"
						loop={player.active.loop}
						muted
						onended={() => player.videoEnded()}
						playsinline
						src={urls.get(player.active.clip.blob)}
					></video>
				{:else}
					<img
						alt=""
						draggable="false"
						class="h-full w-full object-cover"
						src={urls.get(player.active.clip.blob)}
					/>
				{/if}
			</div>
		{/key}
	{/if}
</div>
