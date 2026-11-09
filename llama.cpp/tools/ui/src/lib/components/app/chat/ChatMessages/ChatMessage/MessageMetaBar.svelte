<script lang="ts">
	import { Smile, Star } from '@lucide/svelte';
	import { messageMetaStore } from '$lib/stores/message-meta.svelte';

	let { id, align = 'start' }: { id: string; align?: 'start' | 'end' } = $props();

	const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏'];
	let picking = $state(false);
	const meta = $derived(messageMetaStore.get(id));
</script>

<div
	class="mt-0.5 flex items-center gap-1 text-xs {align === 'end' ? 'justify-end' : 'justify-start'}"
>
	{#if meta.reaction}
		<button
			class="rounded-full border border-border bg-card px-1.5 py-0.5 text-sm leading-none shadow-sm"
			onclick={() => messageMetaStore.react(id, meta.reaction!)}
			title="Remove reaction"
			type="button"
		>
			{meta.reaction}
		</button>
	{/if}

	{#if meta.starred}
		<Star class="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
	{/if}

	<span
		class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 {picking
			? 'opacity-100'
			: ''}"
	>
		{#if picking}
			<span
				class="flex items-center gap-0.5 rounded-full border border-border bg-card px-1 py-0.5 shadow-sm"
			>
				{#each EMOJIS as e (e)}
					<button
						class="rounded-full px-0.5 text-base leading-none transition-transform hover:scale-125"
						onclick={() => {
							messageMetaStore.react(id, e);
							picking = false;
						}}
						type="button"
					>
						{e}
					</button>
				{/each}
			</span>
		{:else}
			<button
				aria-label="React"
				class="rounded-full p-1 text-muted-foreground hover:bg-muted/60"
				onclick={() => (picking = true)}
				type="button"
			>
				<Smile class="h-3.5 w-3.5" />
			</button>
			<button
				aria-label={meta.starred ? 'Unstar' : 'Star'}
				class="rounded-full p-1 text-muted-foreground hover:bg-muted/60"
				onclick={() => messageMetaStore.toggleStar(id)}
				type="button"
			>
				<Star class="h-3.5 w-3.5" />
			</button>
		{/if}
	</span>
</div>
