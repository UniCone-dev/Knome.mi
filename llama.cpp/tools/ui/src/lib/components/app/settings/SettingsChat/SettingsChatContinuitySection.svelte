<script lang="ts">
	import { Layers } from '@lucide/svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { type ContinuityMode,continuityStore } from '$lib/stores/continuity.svelte';

	let c = $derived(continuityStore.config);

	const modes: { id: ContinuityMode; title: string; text: string }[] = [
		{
			id: 'auto',
			text: 'When the context is nearly full, Knome summarizes the chat and opens a new linked chat by itself.',
			title: 'Automatic (recommended)'
		},
		{
			id: 'manual',
			text: 'At the threshold a "Continue in new context" button appears. Nothing happens until you press it.',
			title: 'Manual'
		},
		{
			id: 'off',
			text: 'No handoff. Only llama.cpp\'s normal context shifting applies (the model slowly forgets the start).',
			title: 'Off'
		}
	];
</script>

<div class="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
	<div class="flex items-start gap-3">
		<Layers class="mt-0.5 h-5 w-5 text-primary" />

		<div class="min-w-0 flex-1">
			<h3 class="text-base font-semibold">Context continuity</h3>

			<p class="text-sm text-muted-foreground">
				A long chat fills the model's context. Knome carries goals, decisions, progress, open tasks
				and your preferences over to a fresh chat. The old chat is never changed or deleted, and the
				new chat keeps the same character.
			</p>
		</div>
	</div>

	<div class="space-y-2">
		{#each modes as m (m.id)}
			<label
				class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm {c.mode === m.id
					? 'border-primary bg-primary/5'
					: 'border-border/60'}"
			>
				<input
					checked={c.mode === m.id}
					class="mt-1"
					name="continuity-mode"
					onchange={() => continuityStore.update({ mode: m.id })}
					type="radio"
				/>

				<span>
					<span class="font-medium">{m.title}</span>

					<span class="block text-muted-foreground">{m.text}</span>
				</span>
			</label>
		{/each}
	</div>

	<label
		class="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
	>
		<span>
			<span class="font-medium">Also save a summary to memory at 90%</span>

			<span class="block text-muted-foreground">
				The AI writes the summary itself (visible in the chat) and you can recall it in any chat
				with @chat "Name".
			</span>
		</span>

		<Switch
			checked={c.saveSummary}
			onCheckedChange={(v) => continuityStore.update({ saveSummary: v })}
		/>
	</label>

	{#if c.mode !== 'off'}
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="flex justify-between font-medium">
					<span>Start at context usage</span>

					<span class="text-muted-foreground">{c.threshold}%</span>
				</span>

				<input
					class="w-full"
					max="98"
					min="50"
					oninput={(e) => continuityStore.update({ threshold: +e.currentTarget.value })}
					step="1"
					type="range"
					value={c.threshold}
				/>
			</label>

			<label class="space-y-1 text-sm">
				<span class="flex justify-between font-medium">
					<span>Last messages kept word for word</span>

					<span class="text-muted-foreground">{c.recentCount}</span>
				</span>

				<input
					class="w-full"
					max="10"
					min="0"
					oninput={(e) => continuityStore.update({ recentCount: +e.currentTarget.value })}
					step="1"
					type="range"
					value={c.recentCount}
				/>
			</label>
		</div>
	{/if}
</div>
