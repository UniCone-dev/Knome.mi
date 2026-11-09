<script lang="ts">
	import { Check, Eye, EyeOff, RotateCw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ServerModelStatus } from '$lib/enums';
	import { modelsStore } from '$lib/stores';
	import { mmprojStore } from '$lib/stores/mmproj.svelte';

	const modelId = $derived(mmprojStore.dialogModel);
	const entry = $derived(modelsStore.routerModels.find((m) => m.id === modelId));
	const candidates = $derived(entry?.mmproj?.candidates ?? []);
	const serverSupports = $derived(entry?.mmproj !== undefined);
	const choice = $derived(mmprojStore.get(modelId));
	const isLoaded = $derived(
		entry?.status?.value === ServerModelStatus.LOADED ||
			entry?.status?.value === ServerModelStatus.SLEEPING
	);
	let changed = $state(false);

	const options = $derived([
		{
			value: '',
			title: 'Automatic',
			sub: 'Use the vision file the server finds next to the model (if any).',
			icon: Eye
		},
		...candidates.map((c: { name: string; path: string }) => ({
			value: c.path,
			title: c.name,
			sub: 'Vision projector',
			icon: Eye
		})),
		{ value: 'none', title: 'No vision', sub: 'Text only - uses less memory.', icon: EyeOff }
	]);

	function pick(value: string) {
		mmprojStore.set(modelId, value);
		changed = true;
	}

	async function reload() {
		const id = modelId;

		mmprojStore.dialogModel = '';
		changed = false;
		await modelsStore.status.unload(id);
		await modelsStore.status.load(id);
	}

	function onOpenChange(open: boolean) {
		if (!open) {
			mmprojStore.dialogModel = '';
			changed = false;
		}
	}
</script>

<Dialog.Root {onOpenChange} open={modelId !== ''}>
	<Dialog.Content
		class="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto sm:max-w-lg md:rounded-2xl"
	>
		<Dialog.Title class="flex items-center gap-2 text-lg font-semibold">
			<Eye class="h-5 w-5 text-primary" /> Vision file
		</Dialog.Title>

		<p class="truncate text-sm text-muted-foreground" title={modelId}>{modelId}</p>

		{#if !serverSupports}
			<p class="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
				This llama-server does not report vision files. Rebuild llama-server with the Knome Patch 13
				server change, then reopen this window.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each options as o (o.value)}
					<li>
						<button
							class="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/60 {choice ===
							o.value
								? 'border-primary bg-primary/5'
								: 'border-border'}"
							onclick={() => pick(o.value)}
							type="button"
						>
							<o.icon class="h-4 w-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium">{o.title}</span>
								<span class="block text-xs text-muted-foreground">{o.sub}</span>
							</span>
							{#if choice === o.value}
								<Check class="h-4 w-4 shrink-0 text-primary" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>

			{#if candidates.length === 0}
				<p class="text-xs text-muted-foreground">
					No file with "mmproj" in its name was found next to this model. Put the model's mmproj
					.gguf in the same folder.
				</p>
			{/if}

			<p class="text-xs text-muted-foreground">
				Your choice is saved and used every time this model loads.
			</p>

			{#if changed && isLoaded}
				<Button class="self-end rounded-xl" onclick={reload}>
					<RotateCw class="h-4 w-4" /> Reload model now
				</Button>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
