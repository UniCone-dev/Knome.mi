<script lang="ts">
	import { Lightbulb, X } from '@lucide/svelte';
	import { MarkdownContent } from '$lib/components/app';
	import { settingsStore } from '$lib/stores';
	import { reasoningPanelStore as panel } from '$lib/stores/reasoning-panel.svelte';
	import { fly } from 'svelte/transition';

	let scrollEl: HTMLDivElement | undefined = $state();
	let stickToBottom = true;

	const asMarkdown = $derived(Boolean(settingsStore.config.renderThinkingAsMarkdown));

	function onScroll() {
		if (!scrollEl) return;

		stickToBottom = scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop < 40;
	}

	// follow the text while the model is still thinking, unless the user scrolled up
	$effect(() => {
		void panel.content;

		if (!scrollEl || !panel.streaming || !stickToBottom) return;

		requestAnimationFrame(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	});

	$effect(() => {
		if (panel.isOpen) stickToBottom = true;
	});

	function onKeydown(event: KeyboardEvent) {
		if (panel.isOpen && event.key === 'Escape') panel.close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if panel.isOpen}
	<aside
		class="reasoning-side-panel fixed top-0 right-0 z-40 flex h-dvh w-[min(30rem,100vw)] flex-col border-l border-border/60 bg-background shadow-2xl"
		aria-label="Reasoning"
		transition:fly={{ duration: 180, x: 40 }}
	>
		<header class="flex items-center gap-2 border-b border-border/50 px-4 py-3">
			<Lightbulb class="h-4 w-4 text-muted-foreground" />

			<h2 class="flex-1 text-sm font-semibold">
				{panel.title}

				{#if panel.streaming}
					<span class="shimmer-text ml-1 text-xs font-normal text-muted-foreground"
						>thinking...</span
					>
				{/if}
			</h2>

			<button
				class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				aria-label="Close reasoning panel"
				onclick={() => panel.close()}
				type="button"
			>
				<X class="h-4 w-4" />
			</button>
		</header>

		<div bind:this={scrollEl} class="min-h-0 flex-1 overflow-y-auto px-4 py-4" onscroll={onScroll}>
			{#if panel.content}
				{#if asMarkdown}
					<MarkdownContent class="text-muted-foreground" content={panel.content} />
				{:else}
					<div
						class="text-[13px] leading-relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
					>
						{panel.content}
					</div>
				{/if}
			{:else}
				<p class="text-sm text-muted-foreground">Nothing here yet.</p>
			{/if}
		</div>
	</aside>
{/if}
