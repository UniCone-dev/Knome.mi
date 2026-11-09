<script lang="ts">
	import { ChevronDown, Cpu } from '@lucide/svelte';
	import DialogContextInfo from '$lib/components/app/dialogs/DialogContextInfo.svelte';
	import DialogModelInformation from '$lib/components/app/dialogs/DialogModelInformation.svelte';
	import { useContextGauge } from '$lib/hooks/use-context-gauge.svelte';
	import { ModelsService } from '$lib/services/models.service';
	import { modelsStore, serverStore } from '$lib/stores';
	import { experienceStore } from '$lib/stores/experience.svelte';
	import { uiStore } from '$lib/stores/ui.svelte';

	const gauge = useContextGauge();

	const modelId = $derived(gauge.activeModelId || modelsStore.selectedModelName || '');
	const parsed = $derived(modelId ? ModelsService.parseModelId(modelId) : null);
	const title = $derived(
		parsed?.modelName
			? [parsed.modelName, parsed.params].filter(Boolean).join('-')
			: modelId
					.replace(/\.gguf$/i, '')
					.split(/[\\/]/)
					.pop() || 'No model'
	);
	const sub = $derived(['GGUF', parsed?.quantization].filter(Boolean).join(' · '));
	const loaded = $derived(gauge.isActiveModelLoaded);
	const loading = $derived(gauge.isActiveModelLoading);
	const hasCtx = $derived((gauge.contextTotal ?? 0) > 0);

	function k(n: number): string {
		return n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
	}

	let showModelInfo = $state(false);
	let showContext = $state(false);

	function openModels() {
		uiStore.isModelsOpen = true;
	}
</script>

<header
	class="kn-topbar sticky top-0 z-20 flex items-center gap-3 px-4 py-2.5 backdrop-blur-md md:px-6"
>
	<button
		class="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1 text-left transition-colors hover:bg-muted/60"
		onclick={() => (showModelInfo = true)}
		title="Model details"
		type="button"
	>
		<span
			class="h-2.5 w-2.5 shrink-0 rounded-full {loaded
				? 'bg-emerald-500'
				: loading
					? 'animate-pulse bg-amber-400'
					: 'bg-muted-foreground/40'}"
			title={loaded ? 'Model loaded' : loading ? 'Loading' : 'Not loaded'}
		></span>

		<span class="truncate text-base font-semibold md:text-lg">{title}</span>

		{#if sub}
			<span class="hidden truncate text-sm text-muted-foreground sm:inline">{sub}</span>
		{/if}

		<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
	</button>

	<button
		aria-label="Models"
		class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
		onclick={openModels}
		title="Models: load, unload, vision file"
		type="button"
	>
		<Cpu class="h-4 w-4" />
	</button>

	{#if hasCtx && experienceStore.level !== 'minimal'}
		<button
			class="ml-auto flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/60"
			onclick={() => (showContext = true)}
			title="Context details"
			type="button"
		>
			<span>{k(gauge.contextUsed ?? 0)} / {k(gauge.contextTotal ?? 0)}</span>

			<span class="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
				<span
					class="block h-full rounded-full {gauge.contextPercent && gauge.contextPercent > 85
						? 'bg-red-500'
						: gauge.contextPercent && gauge.contextPercent > 65
							? 'bg-amber-400'
							: 'bg-primary'}"
					style="width: {Math.min(100, gauge.contextPercent ?? 0)}%"
				></span>
			</span>
		</button>
	{/if}
</header>

{#if showModelInfo}
	<DialogModelInformation
		modelId={serverStore.isRouterMode ? modelId || null : null}
		onOpenChange={(v) => (showModelInfo = v)}
		open={showModelInfo}
	/>
{/if}

<DialogContextInfo bind:open={showContext} />
