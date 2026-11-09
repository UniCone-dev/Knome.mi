<script lang="ts">
	import { Brain, ChevronDown, LoaderCircle, Wrench } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { ActivityStatus } from '$lib/utils/activity-groups';

	interface Props {
		/** the model is still working on this block (live label, spinner) */
		active: boolean;
		status: ActivityStatus;
		/** label once finished, e.g. "Thought and used 2 tools" */
		summary: string;
		expanded: boolean;
		onToggle: () => void;
		/** the reasoning and tool-call blocks, shown when expanded */
		children: Snippet;
	}

	let { active, children, expanded, onToggle, status, summary }: Props = $props();

	const label = $derived(
		active ? (status === 'tools' ? 'Using tools...' : 'Thinking...') : summary
	);
</script>

<div class="chat-message-activity w-full">
	<button
		aria-expanded={expanded}
		class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
		onclick={onToggle}
		type="button"
	>
		{#if active}
			<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
		{:else if status === 'tools'}
			<Wrench class="h-3.5 w-3.5" />
		{:else}
			<Brain class="h-3.5 w-3.5" />
		{/if}

		<span class={active ? 'shimmer-text' : ''}>{label}</span>

		<ChevronDown class="h-3.5 w-3.5 transition-transform {expanded ? 'rotate-180' : ''}" />
	</button>

	{#if expanded}
		<div class="mt-2 grid gap-2 border-l-2 border-border/60 pl-3">
			{@render children()}
		</div>
	{/if}
</div>
