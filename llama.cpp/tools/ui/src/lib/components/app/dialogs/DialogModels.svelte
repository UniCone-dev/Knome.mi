<script lang="ts">
	import { Cpu, Eye, ImagePlus, Loader2, Power, PowerOff, RefreshCw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ServerModelStatus } from '$lib/enums';
	import { modelsStore, serverStore } from '$lib/stores';
	import { mmprojStore } from '$lib/stores/mmproj.svelte';
	import { imageGenStore } from '$lib/stores/imagegen.svelte';
	import { uiStore } from '$lib/stores/ui.svelte';

	const models = $derived(modelsStore.routerModels);

	$effect(() => {
		if (uiStore.isModelsOpen && serverStore.isRouterMode) {
			void modelsStore.fetchRouterModels();
		}
	});

	function statusOf(m: (typeof models)[number]): string {
		return String(m.status?.value ?? 'unknown');
	}

	function visionLabel(m: (typeof models)[number]): string {
		const c = mmprojStore.get(m.id);

		if (c === 'none') return 'No vision';
		if (c) return c.split(/[\\/]/).pop() ?? c;
		if (m.architecture?.input_modalities?.includes('image')) return 'Vision: automatic';

		return 'Text only';
	}
</script>

<Dialog.Root bind:open={uiStore.isModelsOpen}>
	<Dialog.Content
		class="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl md:rounded-2xl"
	>
		<Dialog.Title
			class="flex items-center gap-2 border-b border-border/60 px-5 py-4 text-lg font-semibold"
		>
			<Cpu class="h-5 w-5 text-primary" /> Models
		</Dialog.Title>

		<div class="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
			{#if !serverStore.isRouterMode}
				<p class="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
					Model switching needs llama-server in router mode: start it with
					<code>--models-dir /path/to/models</code> (no <code>-m</code>). Every .gguf in that folder
					will then show up here.
				</p>
			{:else if models.length === 0}
				<p class="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
					No models found in the models folder.
				</p>
			{:else}
				{#each models as m (m.id)}
					{@const st = statusOf(m)}
					{@const busy =
						modelsStore.status.isOperationInProgress(m.id) || st === ServerModelStatus.LOADING}
					{@const on = st === ServerModelStatus.LOADED || st === ServerModelStatus.SLEEPING}
					<div class="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
						<span
							class="h-2.5 w-2.5 shrink-0 rounded-full {on
								? 'bg-green-500'
								: st === ServerModelStatus.FAILED
									? 'bg-red-500'
									: 'bg-muted-foreground/40'}"
						></span>

						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium" title={m.id}>{m.id}</p>
							<p class="text-xs text-muted-foreground">
								{on
									? 'Loaded'
									: busy
										? 'Loading...'
										: st === 'failed'
											? 'Failed to load'
											: 'Not loaded'}
								· {visionLabel(m)}
							</p>
						</div>

						<Button
							class="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
							onclick={() => mmprojStore.open(m.id)}
							title="Choose the vision file (mmproj) for this model"
							variant="outline"
						>
							<Eye class="h-3.5 w-3.5" /> Vision
						</Button>

						{#if busy}
							<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
						{:else if on}
							{#if modelsStore.activeModelId !== m.id}
								<Button
									class="h-8 rounded-lg px-2.5 text-xs"
									onclick={() => modelsStore.selectModelById(m.id)}
									title="Chat with this model"
								>
									Use
								</Button>
							{:else}
								<span class="text-xs font-medium text-primary">In use</span>
							{/if}
							<Button
								class="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
								onclick={() => modelsStore.status.unload(m.id)}
								variant="outline"
							>
								<PowerOff class="h-3.5 w-3.5" /> Unload
							</Button>
						{:else}
							<Button
								class="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
								onclick={async () => {
									await modelsStore.status.load(m.id);
									await modelsStore.selectModelById(m.id);
								}}
							>
								<Power class="h-3.5 w-3.5" /> Load
							</Button>
						{/if}
					</div>
				{/each}
			{/if}

			<div class="mt-4 space-y-2 border-t border-border/60 pt-4" data-testid="models-image-section">
				<p class="flex items-center gap-2 text-sm font-semibold">
					<ImagePlus class="h-4 w-4 text-primary" /> Image & video models
					<Button
						class="ml-auto h-7 gap-1.5 rounded-lg px-2 text-xs"
						disabled={imageGenStore.catalogLoading}
						onclick={() => imageGenStore.autoDetect()}
						variant="outline"
					>
						<RefreshCw class="h-3.5 w-3.5 {imageGenStore.catalogLoading ? 'animate-spin' : ''}" />
						Re-detect
					</Button>
				</p>

				{#if !imageGenStore.reachable}
					<p
						class="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground"
					>
						The image server is not running. Start Knome with ./Knome-start.sh (stable-diffusion.cpp
						must be built), then press Re-detect.
					</p>
				{:else}
					{#each [{ kind: 'image', recipe: imageGenStore.config.imageRecipe, parts: imageGenStore.config.imageModels, on: imageGenStore.config.image }, { kind: 'video', recipe: imageGenStore.config.videoRecipe, parts: imageGenStore.config.videoModels, on: imageGenStore.config.video }] as row (row.kind)}
						{#if row.on || row.recipe}
							<div class="rounded-xl border border-border bg-card/60 p-3 text-xs">
								<p class="text-sm font-medium">
									{row.kind === 'image' ? 'Images' : 'Video'}:
									{imageGenStore.recipes.find((r) => r.id === row.recipe)?.name ??
										(row.recipe || 'no model found')}
								</p>
								{#if row.recipe}
									<p class="mt-1 break-words text-muted-foreground">
										{#each Object.entries(row.parts) as [slot, file] (slot)}
											<span class="mr-2 inline-block">{slot}: {file.split('/').pop()}</span>
										{/each}
									</p>
								{:else}
									<p class="mt-1 text-muted-foreground">
										Put the model and its parts in image-models/ then press Re-detect.
									</p>
								{/if}
							</div>
						{/if}
					{/each}
					<p class="text-xs text-muted-foreground">
						Chosen automatically and remembered. Images are made through + &gt; Create image: your
						text model is swapped out and back by itself.
					</p>
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
