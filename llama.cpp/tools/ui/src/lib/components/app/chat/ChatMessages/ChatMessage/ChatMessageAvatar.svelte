<script lang="ts">
	import LivingStill from '$lib/components/app/characters/LivingStill.svelte';
	import LivingView from '$lib/components/app/characters/LivingView.svelte';
	import { avatarShapeStyle, type AvatarShape } from '$lib/stores/characters/index.svelte';
	import { livingStore } from '$lib/stores/living.svelte';

	interface Props {
		avatarUrl: string;
		avatarKind?: 'image' | 'gif' | 'video';
		size: number;
		shape?: AvatarShape;
		alt: string;
		/** Show the living character here (only the AI avatar that is the "current" one). */
		living?: boolean;
		/** An AI avatar that is not the current one: show the character at rest instead of the profile picture. */
		livingRest?: boolean;
	}

	let {
		alt,
		avatarKind,
		avatarUrl,
		living = false,
		livingRest = false,
		shape = 'circle',
		size
	}: Props = $props();

	const modeOn = $derived(livingStore.visible && livingStore.mode === 'avatar');
	const isLiving = $derived(living && modeOn);
	const isRest = $derived(livingRest && modeOn);

	// Hexagon / diamond use clip-path, which would also clip a border, so only
	// the border-radius shapes get one.
	const clipped = $derived(shape === 'hexagon' || shape === 'diamond');
</script>

<div
	class="flex-shrink-0 overflow-hidden bg-muted {clipped ? '' : 'border border-border'}"
	style="height: {size}px; width: {size}px; {avatarShapeStyle(shape)}"
>
	{#if isLiving}
		<LivingView fallbackUrl={avatarUrl || undefined} />
	{:else if isRest}
		<LivingStill fallbackUrl={avatarUrl || undefined} />
	{:else if avatarKind === 'video'}
		<video autoplay class="h-full w-full object-cover" loop muted playsinline src={avatarUrl}
		></video>
	{:else}
		<img {alt} class="h-full w-full object-cover" src={avatarUrl} />
	{/if}
</div>
