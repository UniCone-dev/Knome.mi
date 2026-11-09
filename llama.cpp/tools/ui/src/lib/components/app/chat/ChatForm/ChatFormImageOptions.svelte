<script lang="ts">
	import {
		imageGenStore,
		ASPECTS,
		type Resolution,
		type Quality
	} from '$lib/stores/imagegen.svelte';

	const kind = $derived(imageGenStore.armed);
	const m = $derived(imageGenStore.manual);
	const recipes = $derived(imageGenStore.recipes);
	const cur = $derived(
		kind === 'video' ? imageGenStore.config.videoRecipe : imageGenStore.config.imageRecipe
	);

	const sel =
		'h-8 max-w-[12rem] truncate rounded-md border border-border/60 bg-background py-0 pr-7 pl-2 text-xs leading-8 text-foreground focus:outline-none';

	function pickModel(id: string) {
		if (!kind) return;

		imageGenStore.update(
			kind === 'image' ? { imageRecipe: id, imageModels: {} } : { videoRecipe: id, videoModels: {} }
		);
		imageGenStore.autoFill(kind);
	}

	function set(patch: Partial<typeof m>) {
		imageGenStore.manual = { ...imageGenStore.manual, ...patch };
	}
</script>

{#if kind}
	<div
		class="mx-auto mb-2 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
		data-testid="imagegen-options"
	>
		<label class="flex items-center gap-1.5">
			Model
			<select class={sel} onchange={(e) => pickModel(e.currentTarget.value)} value={cur}>
				<option value="">choose...</option>
				{#each recipes as r (r.id)}
					<option value={r.id}>{r.name ?? r.id}</option>
				{/each}
			</select>
		</label>

		{#if kind === 'image'}
			<label class="flex items-center gap-1.5">
				Aspect
				<select
					class={sel}
					data-testid="imagegen-aspect"
					onchange={(e) => set({ aspect: e.currentTarget.value })}
					value={m.aspect}
				>
					<option value="auto">Auto (AI)</option>
					{#each Object.keys(ASPECTS) as a (a)}
						<option value={a}>{a}</option>
					{/each}
				</select>
			</label>

			<label class="flex items-center gap-1.5">
				Size
				<select
					class={sel}
					onchange={(e) => set({ resolution: e.currentTarget.value as Resolution })}
					value={m.resolution}
				>
					<option value="auto">Auto (AI)</option>
					<option value="standard">Standard</option>
					<option value="high">High</option>
					<option value="max">Max for model</option>
				</select>
			</label>

			<label class="flex items-center gap-1.5">
				Quality
				<select
					class={sel}
					onchange={(e) => set({ quality: e.currentTarget.value as Quality })}
					value={m.quality}
				>
					<option value="auto">Auto (AI)</option>
					<option value="draft">Draft (fast)</option>
					<option value="normal">Normal</option>
					<option value="high">High (slow)</option>
				</select>
			</label>

			<label class="flex items-center gap-1.5">
				Steps
				<input
					class="{sel} w-20 pr-1!"
					min="0"
					max="150"
					onchange={(e) => set({ steps: Math.max(0, Math.round(+e.currentTarget.value || 0)) })}
					placeholder="Auto"
					type="number"
					value={m.steps || ''}
				/>
			</label>
		{/if}

		<span class="opacity-70">Leave "Auto" and just tell the AI what you want.</span>
	</div>
{/if}
