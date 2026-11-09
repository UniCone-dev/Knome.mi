<script lang="ts">
	import { avatarShapeStyle, type AvatarShape } from '$lib/stores/characters/index.svelte';

	interface Props {
		avatarUrl: string;
		avatarKind?: 'image' | 'gif' | 'video';
		size: number;
		shape?: AvatarShape;
		alt: string;
	}

	let { alt, avatarKind, avatarUrl, shape = 'circle', size }: Props = $props();

	// Hexagon / diamond use clip-path, which would also clip a border, so only
	// the border-radius shapes get one.
	const clipped = $derived(shape === 'hexagon' || shape === 'diamond');
</script>

<div
	class="flex-shrink-0 overflow-hidden bg-muted {clipped ? '' : 'border border-border'}"
	style="height: {size}px; width: {size}px; {avatarShapeStyle(shape)}"
>
	{#if avatarKind === 'video'}
		<video autoplay class="h-full w-full object-cover" loop muted playsinline src={avatarUrl}
		></video>
	{:else}
		<img {alt} class="h-full w-full object-cover" src={avatarUrl} />
	{/if}
</div>
