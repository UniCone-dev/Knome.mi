<script lang="ts">
	// One avatar for every place the Messenger layout shows a contact: the picture in the user's
	// chosen frame shape, or a coloured orb with the initial when there is no picture.
	import ChatMessageAvatar from '$lib/components/app/chat/ChatMessages/ChatMessage/ChatMessageAvatar.svelte';
	import { charactersStore } from '$lib/stores';
	import { avatarShapeStyle } from '$lib/stores/characters/index.svelte';

	interface Props {
		name: string;
		url?: string;
		kind?: 'image' | 'gif' | 'video';
		size?: number;
	}

	let { kind, name, size = 48, url }: Props = $props();

	function hueFor(s: string): number {
		let h = 0;

		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;

		return h % 360;
	}

	const hue = $derived(hueFor(name));
	const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
</script>

{#if url}
	<ChatMessageAvatar alt={name} avatarKind={kind} avatarUrl={url} shape={charactersStore.avatarShape} {size} />
{:else}
	<div
		class="flex flex-shrink-0 items-center justify-center font-semibold text-white"
		style="width:{size}px;height:{size}px;font-size:{Math.round(size * 0.42)}px;background:linear-gradient(135deg, oklch(0.66 0.16 {hue}), oklch(0.5 0.18 {hue +
			50}));{avatarShapeStyle(charactersStore.avatarShape)}"
	>
		{initial}
	</div>
{/if}
