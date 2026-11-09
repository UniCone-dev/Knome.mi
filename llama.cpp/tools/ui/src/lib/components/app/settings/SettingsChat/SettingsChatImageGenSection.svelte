<script lang="ts">
	import { ImagePlus, RefreshCw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { onMount } from 'svelte';
	import { imageGenStore, type GenKind } from '$lib/stores/imagegen.svelte';

	onMount(() => {
		if (imageGenStore.config.enabled && !imageGenStore.recipes.length) imageGenStore.autoDetect();
	});

	const c = $derived(imageGenStore.config);

	function recipeOf(kind: GenKind) {
		const id = kind === 'image' ? c.imageRecipe : c.videoRecipe;

		return imageGenStore.recipes.find((r) => r.id === id);
	}

	function pickRecipe(kind: GenKind, id: string) {
		imageGenStore.update(
			kind === 'image' ? { imageRecipe: id, imageModels: {} } : { videoRecipe: id, videoModels: {} }
		);
		imageGenStore.autoFill(kind);
	}

	function pickFile(kind: GenKind, slot: string, id: string) {
		const cur = { ...(kind === 'image' ? c.imageModels : c.videoModels), [slot]: id };

		imageGenStore.update(kind === 'image' ? { imageModels: cur } : { videoModels: cur });
	}

	const selectCls = 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';
	const inputCls = selectCls;
</script>

<div class="space-y-4 border-t border-border/30 pt-4" data-testid="imagegen-settings">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h3 class="flex items-center gap-2 text-base font-semibold">
				<ImagePlus class="size-4" /> Image & video (Smart workload)
			</h3>
			<p class="text-sm text-muted-foreground">
				Off by default. When on, the + menu gets "Create image". Your text model is unloaded, the
				image model (stable-diffusion.cpp) is loaded, the picture is made, then the image model is
				unloaded and your text model comes back by itself.
			</p>
		</div>

		<Switch checked={c.enabled} onCheckedChange={(v) => imageGenStore.update({ enabled: v })} />
	</div>

	{#if c.enabled}
		<div class="grid gap-3 sm:grid-cols-2">
			<label
				class="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
			>
				<span>Images</span>
				<Switch checked={c.image} onCheckedChange={(v) => imageGenStore.update({ image: v })} />
			</label>

			<label
				class="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
			>
				<span>Video</span>
				<Switch checked={c.video} onCheckedChange={(v) => imageGenStore.update({ video: v })} />
			</label>

			<label
				class="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
			>
				<span>AI may start it by itself when I ask for a picture</span>
				<Switch
					checked={c.aiCanStart}
					onCheckedChange={(v) => imageGenStore.update({ aiCanStart: v })}
				/>
			</label>

			<label
				class="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm"
			>
				<span>Show "Image ready" note under the picture</span>
				<Switch
					checked={c.announce}
					onCheckedChange={(v) => imageGenStore.update({ announce: v })}
				/>
			</label>
		</div>

		<div class="space-y-1">
			<label class="text-sm font-medium" for="sd-url">Image server address</label>
			<div class="flex gap-2">
				<input
					id="sd-url"
					class={inputCls}
					value={c.sdUrl}
					onchange={(e) => imageGenStore.update({ sdUrl: e.currentTarget.value })}
				/>
				<Button
					disabled={imageGenStore.catalogLoading}
					onclick={() => imageGenStore.autoDetect()}
					size="sm"
					variant="outline"
				>
					<RefreshCw class="size-3.5 {imageGenStore.catalogLoading ? 'animate-spin' : ''}" />
					Auto-detect models
				</Button>
			</div>

			{#if imageGenStore.catalogError}
				<p class="text-xs text-destructive">{imageGenStore.catalogError}</p>
			{:else if imageGenStore.recipes.length}
				<p class="text-xs text-muted-foreground">
					{imageGenStore.recipes.length} model types, {imageGenStore.files.length} files found.
				</p>
			{/if}
		</div>

		{#each (['image', 'video'] as GenKind[]).filter( (k) => (k === 'image' ? c.image : c.video) ) as kind (kind)}
			{@const recipe = recipeOf(kind)}
			<div class="space-y-2 rounded-lg border border-border/60 p-3">
				<div class="text-sm font-medium">{kind === 'image' ? 'Image model' : 'Video model'}</div>

				<select
					class={selectCls}
					value={kind === 'image' ? c.imageRecipe : c.videoRecipe}
					onchange={(e) => pickRecipe(kind, e.currentTarget.value)}
				>
					<option value="">- choose a model type -</option>
					{#each imageGenStore.recipes as r (r.id)}
						<option value={r.id}>{r.name ?? r.id}</option>
					{/each}
				</select>

				{#if recipe}
					{#each recipe.slots as slot (slot.id)}
						<div class="grid items-center gap-1 sm:grid-cols-[10rem_1fr]">
							<span class="text-xs text-muted-foreground">
								{slot.label ?? slot.id}{slot.required ? ' *' : ''}
							</span>
							<select
								class={selectCls}
								value={(kind === 'image' ? c.imageModels : c.videoModels)[slot.id] ?? ''}
								onchange={(e) => pickFile(kind, slot.id, e.currentTarget.value)}
							>
								<option value="">{slot.required ? '- choose a file -' : '- none -'}</option>
								{#each imageGenStore.filesForSlot(slot.id) as f (f.id)}
									<option value={f.id}>{f.name}</option>
								{/each}
							</select>
						</div>
					{/each}
				{:else}
					<p class="text-xs text-muted-foreground">
						Press "Auto-detect models" first (sd-server must be running).
					</p>
				{/if}
			</div>
		{/each}

		<p class="text-xs text-muted-foreground">
			These are only defaults. In chat you can simply say "16:9, high quality, 40 steps, seed 7, no
			text" - the AI sets size, steps, cfg, seed, sampler and negative prompt per picture. Attach a
			picture and ask for a change to edit it.
		</p>

		<div class="grid gap-3 sm:grid-cols-5">
			<label class="space-y-1 text-xs">
				Width
				<input
					class={inputCls}
					type="number"
					step="64"
					value={c.width}
					onchange={(e) => imageGenStore.update({ width: +e.currentTarget.value || 1024 })}
				/>
			</label>
			<label class="space-y-1 text-xs">
				Height
				<input
					class={inputCls}
					type="number"
					step="64"
					value={c.height}
					onchange={(e) => imageGenStore.update({ height: +e.currentTarget.value || 1024 })}
				/>
			</label>
			<label class="space-y-1 text-xs">
				Steps (0 = model default)
				<input
					class={inputCls}
					type="number"
					value={c.steps}
					onchange={(e) =>
						imageGenStore.update({ steps: Math.max(0, +e.currentTarget.value || 0) })}
				/>
			</label>
			<label class="space-y-1 text-xs">
				CFG (0 = model default)
				<input
					class={inputCls}
					type="number"
					step="0.5"
					value={c.cfg}
					onchange={(e) => imageGenStore.update({ cfg: Math.max(0, +e.currentTarget.value || 0) })}
				/>
			</label>
			<label class="space-y-1 text-xs">
				Negative prompt
				<input
					class={inputCls}
					value={c.negative}
					onchange={(e) => imageGenStore.update({ negative: e.currentTarget.value })}
				/>
			</label>
		</div>

		{#if c.video}
			<div class="grid gap-3 sm:grid-cols-3">
				<label class="space-y-1 text-xs">
					Video frames
					<input
						class={inputCls}
						type="number"
						value={c.videoFrames}
						onchange={(e) => imageGenStore.update({ videoFrames: +e.currentTarget.value || 33 })}
					/>
				</label>
				<label class="space-y-1 text-xs">
					FPS
					<input
						class={inputCls}
						type="number"
						value={c.videoFps}
						onchange={(e) => imageGenStore.update({ videoFps: +e.currentTarget.value || 16 })}
					/>
				</label>
				<label class="space-y-1 text-xs">
					Format
					<select
						class={selectCls}
						value={c.videoFormat}
						onchange={(e) =>
							imageGenStore.update({
								videoFormat: e.currentTarget.value as 'webm' | 'webp' | 'avi'
							})}
					>
						<option value="webm">webm</option>
						<option value="webp">animated webp</option>
						<option value="avi">avi</option>
					</select>
				</label>
			</div>
		{/if}
	{/if}
</div>
