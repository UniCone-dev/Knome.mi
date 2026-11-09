<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import { ReasoningEffort } from '$lib/enums';
	import { useReasoningMenu } from '$lib/hooks/use-reasoning-menu.svelte';

	let { disabled = false }: { disabled?: boolean } = $props();

	const reasoning = useReasoningMenu();

	function toggle() {
		const target = reasoning.isReasoningActive ? ReasoningEffort.OFF : ReasoningEffort.DEFAULT;
		const level = reasoning.levels.find((l) => l.value === target);

		if (level) reasoning.select(level);
	}
</script>

{#if reasoning.modelSupportsThinking}
	<button
		aria-pressed={reasoning.isReasoningActive}
		class="cf-think inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors hover:bg-muted/70 {reasoning.isReasoningActive
			? 'bg-primary/10 text-primary'
			: 'text-muted-foreground'}"
		{disabled}
		onclick={toggle}
		title={reasoning.isReasoningActive ? 'Thinking is on - click to turn off' : 'Turn thinking on'}
		type="button"
	>
		<Lightbulb class="h-4 w-4" />
		<span>Think</span>
	</button>
{/if}
