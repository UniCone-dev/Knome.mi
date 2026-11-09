<script lang="ts">
	import { Gauge } from '@lucide/svelte';
	import ContextGaugeDetails from '$lib/components/app/chat/ChatForm/ChatFormContextGauge/ContextGaugeDetails.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { useContextGauge } from '$lib/hooks/use-context-gauge.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	const gauge = useContextGauge();

	$effect(() => {
		gauge.startMonitoring();
	});

	const used = $derived(gauge.contextUsed ?? 0);
	const total = $derived(gauge.contextTotal ?? 0);
	const pct = $derived(Math.min(100, gauge.contextPercent ?? 0));
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto sm:max-w-md md:rounded-2xl"
	>
		<Dialog.Title class="flex items-center gap-2 text-lg font-semibold">
			<Gauge class="h-5 w-5 text-primary" /> Context
		</Dialog.Title>

		<div class="space-y-2">
			<div class="flex items-baseline justify-between">
				<span class="text-2xl font-semibold">{pct.toFixed(0)}%</span>
				<span class="font-mono text-sm text-muted-foreground">
					{used.toLocaleString()} / {total.toLocaleString()} tokens
				</span>
			</div>

			<div class="h-2.5 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full {pct > 85
						? 'bg-red-500'
						: pct > 65
							? 'bg-amber-400'
							: 'bg-primary'}"
					style="width: {pct}%"
				></div>
			</div>

			<p class="text-xs text-muted-foreground">
				The context is how much of the conversation the model can "see" at once. When it fills up,
				the oldest part is dropped (see Settings → General → Context shift mode).
			</p>
		</div>

		<ContextGaugeDetails
			averageTokensPerSecond={gauge.averageTokensPerSecond}
			cumulativeCacheTotal={gauge.cumulativeCacheTotal}
			cumulativeOutput={gauge.cumulativeOutput}
			cumulativeRead={gauge.cumulativeRead}
			currentCache={gauge.currentCache}
			currentFresh={gauge.currentFresh}
			currentOutput={gauge.currentOutput}
			currentRead={gauge.currentRead}
			kvTotal={gauge.kvTotal}
			transientDetails={gauge.transientDetails}
		/>
	</Dialog.Content>
</Dialog.Root>
