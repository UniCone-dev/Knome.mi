<script lang="ts">
	import { Check, Gauge, Leaf, Rocket } from '@lucide/svelte';
	import { EXPERIENCE_OPTIONS, experienceStore } from '$lib/stores/experience.svelte';

	const icons = { minimal: Leaf, pro: Gauge, full: Rocket };
</script>

<div class="grid gap-3 sm:grid-cols-3">
	{#each EXPERIENCE_OPTIONS as o (o.value)}
		{@const Icon = icons[o.value]}
		<button
			class="relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors hover:bg-muted/50 {experienceStore.level ===
			o.value
				? 'border-primary bg-primary/5'
				: 'border-border'}"
			onclick={() => experienceStore.set(o.value)}
			type="button"
		>
			<Icon class="h-5 w-5 text-primary" />
			<span class="text-sm font-semibold">{o.title}</span>
			<span class="text-xs leading-snug text-muted-foreground">{o.sub}</span>

			{#if experienceStore.level === o.value}
				<Check class="absolute top-3 right-3 h-4 w-4 text-primary" />
			{/if}
		</button>
	{/each}
</div>
