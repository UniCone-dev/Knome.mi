<script lang="ts">
	import { Eye, FileCode, ImagePlus, Play, RotateCcw, Trash2, Upload, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		APPEARANCE_MAX_IMAGE_BYTES,
		EMPTY_LIVE_CODE,
		LIVE_WALLPAPER_EXAMPLES,
		type AppearanceImageFit,
		type AppearanceUnit,
		type LiveWallpaperCode
	} from '$lib/constants/appearance.constants';
	import { appearanceStore, imageLayerStyle } from '$lib/stores/appearance.svelte';
	import { buildLiveWallpaperDoc, hasWallpaperCode } from '$lib/utils/appearance-doc';
	import { portalToBody } from '$lib/utils/portal-to-body';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	type CodeTab = keyof LiveWallpaperCode;

	const CODE_TABS: { id: CodeTab; label: string; placeholder: string }[] = [
		{
			id: 'html',
			label: 'HTML',
			placeholder: '<canvas id="c"></canvas>\n<div class="glow"></div>'
		},
		{ id: 'css', label: 'CSS', placeholder: 'html, body { background: #0b1020; }\n.glow { ... }' },
		{
			id: 'js',
			label: 'JavaScript',
			placeholder: "const c = document.getElementById('c');\n// draw, animate ..."
		},
		{
			id: 'svg',
			label: 'SVG',
			placeholder: '<svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">...</svg>'
		}
	];

	const FIT_OPTIONS: { value: AppearanceImageFit; label: string }[] = [
		{ value: 'cover', label: 'Cover (fill the screen, crop the edges)' },
		{ value: 'contain', label: 'Contain (whole image visible)' },
		{ value: 'fill', label: 'Stretch (exact screen size)' },
		{ value: 'custom', label: 'Custom size (width / height)' },
		{ value: 'tile', label: 'Tile (repeat)' }
	];

	const UNITS: AppearanceUnit[] = ['%', 'px', 'vw', 'vh'];

	const selectClass =
		'h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

	let p = $derived(appearanceStore.prefs);

	// ----- live wallpaper editor (the draft is only saved when "Apply" is pressed) -----
	let draft = $state<LiveWallpaperCode>({ ...EMPTY_LIVE_CODE });
	let draftLoaded = false;
	let codeTab = $state<CodeTab>('html');
	let previewDoc = $state('');
	let previewWidth = $state(0);
	let fullPreview = $state<'live' | 'image' | null>(null);
	let fullPreviewDoc = $state('');

	$effect(() => {
		if (appearanceStore.ready && !draftLoaded) {
			draftLoaded = true;
			draft = { ...appearanceStore.live };
		}
	});

	let dirty = $derived(
		draft.html !== appearanceStore.live.html ||
			draft.css !== appearanceStore.live.css ||
			draft.js !== appearanceStore.live.js ||
			draft.svg !== appearanceStore.live.svg
	);

	// the small preview follows the draft, a moment after the typing stops
	$effect(() => {
		const code = { ...draft };
		const allowNetwork = p.liveAllowNetwork;

		const timer = setTimeout(() => {
			appearanceStore.clearError('preview');
			previewDoc = hasWallpaperCode(code)
				? buildLiveWallpaperDoc(code, { allowNetwork, channel: 'preview' })
				: '';
		}, 500);

		return () => clearTimeout(timer);
	});

	function loadExample(id: string) {
		const example = LIVE_WALLPAPER_EXAMPLES.find((e) => e.id === id);

		if (!example) return;

		if (
			dirty &&
			hasWallpaperCode(draft) &&
			!confirm('Replace the code in the editor with this example?')
		) {
			return;
		}

		draft = { ...example.code };
		codeTab = example.code.html ? 'html' : example.code.svg ? 'svg' : 'css';
	}

	async function importCodeFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		input.value = '';

		if (!file) return;

		if (file.size > 2_000_000) {
			toast.error('That file is too large for a wallpaper (max 2 MB).');

			return;
		}

		const text = await file.text();
		const name = file.name.toLowerCase();
		const tab: CodeTab = name.endsWith('.css')
			? 'css'
			: name.endsWith('.js') || name.endsWith('.mjs')
				? 'js'
				: name.endsWith('.svg')
					? 'svg'
					: 'html';

		draft = { ...draft, [tab]: text };
		codeTab = tab;
		toast.success(`Loaded ${file.name} into the ${CODE_TABS.find((t) => t.id === tab)?.label} tab`);
	}

	function onCodeKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab' || event.shiftKey) return;

		event.preventDefault();

		const el = event.currentTarget as HTMLTextAreaElement;
		const { selectionStart: start, selectionEnd: end, value } = el;

		draft = { ...draft, [codeTab]: value.slice(0, start) + '\t' + value.slice(end) };

		queueMicrotask(() => {
			el.selectionStart = el.selectionEnd = start + 1;
		});
	}

	async function applyLive() {
		const error = await appearanceStore.setLive(draft);

		if (error) toast.error(error);
		else toast.success('Live wallpaper applied. Close Settings to see it behind the app.');
	}

	async function removeLive() {
		await appearanceStore.clearLive();
		draft = { ...EMPTY_LIVE_CODE };
		toast.success('Live wallpaper removed');
	}

	function startFullPreview(kind: 'live' | 'image') {
		if (kind === 'live') {
			if (!hasWallpaperCode(draft)) {
				toast.error('Write or load some wallpaper code first.');

				return;
			}

			appearanceStore.clearError('preview');
			fullPreviewDoc = buildLiveWallpaperDoc(draft, {
				allowNetwork: p.liveAllowNetwork,
				channel: 'preview'
			});
		}

		fullPreview = kind;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (fullPreview && event.key === 'Escape') {
			// keep Settings open: Escape only closes the preview
			event.preventDefault();
			event.stopPropagation();
			fullPreview = null;
		}
	}

	onDestroy(() => {
		fullPreview = null;
	});

	// ----- image -----
	let fileInput: HTMLInputElement | undefined = $state();
	let dragOver = $state(false);

	async function takeImage(file: File | undefined) {
		if (!file) return;

		const error = await appearanceStore.setImage(file);

		if (error) toast.error(error);
		else toast.success('Background image applied');
	}

	function onImageDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		void takeImage(event.dataTransfer?.files?.[0]);
	}

	const POSITION_GRID = [0, 50, 100];

	function confirmResetAll() {
		if (
			!confirm('Remove the saved wallpaper code, the background image and all Appearance settings?')
		)
			return;

		void appearanceStore.resetAll().then(() => {
			draft = { ...EMPTY_LIVE_CODE };
			toast.success('Appearance reset');
		});
	}

	function selectMode(mode: 'off' | 'live' | 'image') {
		if (mode === 'live' && !appearanceStore.hasLive) {
			toast.info('No live wallpaper saved yet: write the code below and press "Apply wallpaper".');

			return;
		}

		if (mode === 'image' && !appearanceStore.hasImage) {
			toast.info('No image yet: upload one in the "Background image" section below.');

			return;
		}

		appearanceStore.update({ mode });
	}

	let liveError = $derived(appearanceStore.errors['main'] ?? '');
	let previewError = $derived(appearanceStore.errors['preview'] ?? '');
</script>

<svelte:window onkeydowncapture={onWindowKeydown} />

{#snippet slider(
	label: string,
	value: number,
	min: number,
	max: number,
	unit: string,
	onchange: (v: number) => void,
	step: number = 1
)}
	<div class="space-y-1">
		<div class="flex items-center justify-between text-sm">
			<Label class="font-normal">{label}</Label>

			<span class="tabular-nums text-xs text-muted-foreground">{value}{unit}</span>
		</div>

		<input
			class="w-full cursor-pointer accent-[var(--primary)]"
			{max}
			{min}
			oninput={(e) => onchange(Number(e.currentTarget.value))}
			{step}
			type="range"
			{value}
		/>
	</div>
{/snippet}

<div class="min-w-0 space-y-8">
	<div class="space-y-1">
		<p class="text-sm text-muted-foreground">
			Replace the theme's background with your own live wallpaper (HTML, CSS, JavaScript, SVG) or an
			image from your computer. Only the background changes, the interface stays exactly as it is.
			Everything is stored in this browser, and changes on this page apply immediately (no need to
			press "Save settings").
		</p>
	</div>

	<!-- ============ which background is active ============ -->
	<section class="space-y-3">
		<h3 class="text-sm font-semibold">Active background</h3>

		<div class="grid gap-2 sm:grid-cols-3" role="radiogroup">
			{#each [{ id: 'off', label: 'Theme default', hint: "The theme's own background" }, { id: 'live', label: 'Live wallpaper', hint: appearanceStore.hasLive ? 'Your HTML / CSS / JS / SVG' : 'Not created yet' }, { id: 'image', label: 'Background image', hint: appearanceStore.hasImage ? appearanceStore.prefs.imageName || 'Your image' : 'Not uploaded yet' }] as option (option.id)}
				<button
					class="rounded-lg border p-3 text-left transition-colors hover:bg-accent {p.mode ===
					option.id
						? 'border-primary bg-accent'
						: 'border-border/60'}"
					aria-checked={p.mode === option.id}
					onclick={() => selectMode(option.id as 'off' | 'live' | 'image')}
					role="radio"
					type="button"
				>
					<div class="text-sm font-medium">{option.label}</div>

					<div class="truncate text-xs text-muted-foreground">{option.hint}</div>
				</button>
			{/each}
		</div>

		<div class="space-y-3 pt-1">
			{@render slider(
				'Readability overlay (dims the wallpaper in the theme colour)',
				p.dim,
				0,
				90,
				'%',
				(v) => appearanceStore.update({ dim: v })
			)}

			<div class="flex items-start gap-2">
				<Checkbox
					checked={p.hideThemeBackground}
					class="mt-0.5"
					id="appearance-hide-theme"
					onCheckedChange={(c) => appearanceStore.update({ hideThemeBackground: Boolean(c) })}
				/>

				<div>
					<Label class="text-sm font-normal" for="appearance-hide-theme">
						Hide the theme's own animated background while a wallpaper is on
					</Label>

					<p class="text-xs text-muted-foreground">
						Floating blobs, sakura petals, neon glow and the start-screen particles. Turn off to
						layer them over your wallpaper.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ============ live wallpaper ============ -->
	<section class="space-y-4 border-t border-border/30 pt-6">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h3 class="flex items-center gap-2 text-sm font-semibold">
				<FileCode class="h-4 w-4" />
				Live wallpaper (HTML / CSS / JS / SVG)

				{#if p.mode === 'live' && appearanceStore.active}
					<span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
						ACTIVE
					</span>
				{/if}
			</h3>

			<div class="flex flex-wrap items-center gap-2">
				<select
					class={selectClass}
					aria-label="Load an example wallpaper"
					onchange={(e) => {
						loadExample(e.currentTarget.value);
						e.currentTarget.value = '';
					}}
				>
					<option value="">Load an example…</option>

					{#each LIVE_WALLPAPER_EXAMPLES as example (example.id)}
						<option value={example.id}>{example.label}</option>
					{/each}
				</select>

				<label class="inline-flex cursor-pointer">
					<input
						accept=".html,.htm,.css,.js,.mjs,.svg,text/html,text/css,text/javascript,image/svg+xml"
						class="hidden"
						onchange={importCodeFile}
						type="file"
					/>

					<span
						class="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
					>
						<Upload class="h-3.5 w-3.5" />
						Import file
					</span>
				</label>
			</div>
		</div>

		<p class="text-xs text-muted-foreground">
			Write each part in its tab, or paste a complete page into the HTML tab (the CSS / JS / SVG
			tabs are added to it). The code runs in a sealed sandbox: it cannot read your chats or
			settings. Make it fill the window (100% width / height, <code>position: absolute</code>); the
			page background is transparent unless you set one.
		</p>

		<!-- preview -->
		<div
			class="relative aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-muted"
			bind:clientWidth={previewWidth}
		>
			{#if previewDoc}
				{#key previewDoc}
					<iframe
						style="position:absolute;top:0;left:0;width:1280px;height:720px;border:0;transform-origin:0 0;transform:scale({previewWidth /
							1280});pointer-events:none;color-scheme:normal;background:transparent"
						sandbox="allow-scripts"
						srcdoc={previewDoc}
						tabindex="-1"
						title="Wallpaper preview"
					></iframe>
				{/key}
			{:else}
				<div class="flex h-full items-center justify-center text-xs text-muted-foreground">
					Preview appears here as you write
				</div>
			{/if}

			<span
				class="pointer-events-none absolute top-2 left-2 rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
			>
				Draft preview
			</span>
		</div>

		{#if previewError}
			<p
				class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
			>
				Script error in the draft: {previewError}
			</p>
		{/if}

		<!-- editor -->
		<div class="space-y-2">
			<div class="flex gap-1 border-b border-border/40" role="tablist">
				{#each CODE_TABS as tab (tab.id)}
					<button
						class="-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors {codeTab === tab.id
							? 'border-primary font-medium'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
						aria-selected={codeTab === tab.id}
						onclick={() => (codeTab = tab.id)}
						role="tab"
						type="button"
					>
						{tab.label}

						{#if draft[tab.id].trim()}
							<span class="ml-0.5 text-primary">•</span>
						{/if}
					</button>
				{/each}
			</div>

			<textarea
				class="h-72 w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-ring focus:outline-none"
				autocapitalize="off"
				autocomplete="off"
				onkeydown={onCodeKeydown}
				oninput={(e) => (draft = { ...draft, [codeTab]: e.currentTarget.value })}
				placeholder={CODE_TABS.find((t) => t.id === codeTab)?.placeholder}
				spellcheck="false"
				value={draft[codeTab]}
				wrap="off"
			></textarea>
		</div>

		<div class="flex items-start gap-2">
			<Checkbox
				checked={p.liveAllowNetwork}
				class="mt-0.5"
				id="appearance-live-network"
				onCheckedChange={(c) => appearanceStore.update({ liveAllowNetwork: Boolean(c) })}
			/>

			<div>
				<Label class="text-sm font-normal" for="appearance-live-network">
					Allow the wallpaper code to use the internet
				</Label>

				<p class="text-xs text-muted-foreground">
					Needed for CDN libraries (three.js, p5 ...), web fonts or remote images. Off by default:
					the code is then sealed off from every network request. Only turn this on for code you
					trust.
				</p>
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			{@render slider('Wallpaper opacity', p.liveOpacity, 5, 100, '%', (v) =>
				appearanceStore.update({ liveOpacity: v })
			)}

			{@render slider('Wallpaper blur', p.liveBlur, 0, 40, 'px', (v) =>
				appearanceStore.update({ liveBlur: v })
			)}
		</div>

		{#if liveError}
			<p
				class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
			>
				The applied wallpaper reported a script error: {liveError}
			</p>
		{/if}

		<div class="flex flex-wrap items-center gap-2">
			<Button onclick={applyLive}>
				<Play class="h-3.5 w-3.5" />
				Apply wallpaper
			</Button>

			<Button onclick={() => startFullPreview('live')} variant="outline">
				<Eye class="h-3.5 w-3.5" />
				Full-screen preview
			</Button>

			<Button
				disabled={!hasWallpaperCode(draft)}
				onclick={() => (draft = { ...EMPTY_LIVE_CODE })}
				variant="ghost"
			>
				Clear editor
			</Button>

			{#if appearanceStore.hasLive}
				<Button onclick={removeLive} variant="ghost">
					<Trash2 class="h-3.5 w-3.5" />
					Remove saved wallpaper
				</Button>
			{/if}

			{#if dirty && hasWallpaperCode(draft)}
				<span class="text-xs text-muted-foreground">Unsaved changes</span>
			{/if}
		</div>
	</section>

	<!-- ============ background image ============ -->
	<section class="space-y-4 border-t border-border/30 pt-6">
		<h3 class="flex items-center gap-2 text-sm font-semibold">
			<ImagePlus class="h-4 w-4" />
			Background image

			{#if p.mode === 'image' && appearanceStore.active}
				<span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
					ACTIVE
				</span>
			{/if}
		</h3>

		<input
			bind:this={fileInput}
			accept="image/*"
			class="hidden"
			onchange={(e) => {
				void takeImage(e.currentTarget.files?.[0]);
				e.currentTarget.value = '';
			}}
			type="file"
		/>

		<div
			class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed {dragOver
				? 'border-primary bg-accent/40'
				: 'border-border/60'} bg-muted/40"
			ondragleave={() => (dragOver = false)}
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondrop={onImageDrop}
			role="presentation"
		>
			{#if appearanceStore.hasImage}
				<div class="absolute inset-0 overflow-hidden" style="background:var(--background)">
					<div style={imageLayerStyle(p, appearanceStore.imageUrl)}></div>

					{#if p.dim > 0}
						<div
							class="absolute inset-0"
							style="background:var(--background);opacity:{p.dim / 100}"
						></div>
					{/if}
				</div>

				<span
					class="pointer-events-none absolute top-2 left-2 rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
				>
					Preview
				</span>
			{:else}
				<button
					class="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground hover:text-foreground"
					onclick={() => fileInput?.click()}
					type="button"
				>
					<ImagePlus class="h-8 w-8" />

					<span>Click to choose an image, or drop one here</span>

					<span class="text-xs">
						PNG, JPG, WebP, GIF (animated GIFs work), up to {Math.round(
							APPEARANCE_MAX_IMAGE_BYTES / 1024 / 1024
						)} MB
					</span>
				</button>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<Button onclick={() => fileInput?.click()} variant="outline">
				<Upload class="h-3.5 w-3.5" />
				{appearanceStore.hasImage ? 'Replace image' : 'Choose image'}
			</Button>

			{#if appearanceStore.hasImage}
				<Button
					onclick={() => appearanceStore.update({ mode: 'image' })}
					disabled={p.mode === 'image'}
				>
					Use as background
				</Button>

				<Button onclick={() => startFullPreview('image')} variant="outline">
					<Eye class="h-3.5 w-3.5" />
					Full-screen preview
				</Button>

				<Button onclick={() => void appearanceStore.clearImage()} variant="ghost">
					<Trash2 class="h-3.5 w-3.5" />
					Remove image
				</Button>
			{/if}
		</div>

		{#if appearanceStore.hasImage}
			<div class="space-y-4 rounded-lg border border-border/50 p-4">
				<div class="flex items-center justify-between">
					<h4 class="text-sm font-medium">Image size and position</h4>

					<Button onclick={() => appearanceStore.resetImageAdjustments()} size="sm" variant="ghost">
						<RotateCcw class="h-3 w-3" />
						Reset
					</Button>
				</div>

				<div class="space-y-1.5">
					<Label class="text-sm font-normal" for="appearance-fit">Fit</Label>

					<select
						class="{selectClass} w-full"
						id="appearance-fit"
						onchange={(e) =>
							appearanceStore.update({ imageFit: e.currentTarget.value as AppearanceImageFit })}
						value={p.imageFit}
					>
						{#each FIT_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				{#if p.imageFit === 'custom'}
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label class="text-sm font-normal" for="appearance-width">Width</Label>

							<div class="flex gap-2">
								<Input
									id="appearance-width"
									min="1"
									oninput={(e) =>
										appearanceStore.update({ imageWidth: Number(e.currentTarget.value) || 1 })}
									type="number"
									value={p.imageWidth}
								/>

								<select
									class="{selectClass} w-20 shrink-0"
									aria-label="Width unit"
									onchange={(e) =>
										appearanceStore.update({
											imageWidthUnit: e.currentTarget.value as AppearanceUnit
										})}
									value={p.imageWidthUnit}
								>
									{#each UNITS as unit (unit)}
										<option value={unit}>{unit}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="space-y-1.5">
							<Label class="text-sm font-normal" for="appearance-height">
								Height (0 = automatic)
							</Label>

							<div class="flex gap-2">
								<Input
									id="appearance-height"
									min="0"
									oninput={(e) =>
										appearanceStore.update({ imageHeight: Number(e.currentTarget.value) || 0 })}
									type="number"
									value={p.imageHeight}
								/>

								<select
									class="{selectClass} w-20 shrink-0"
									aria-label="Height unit"
									onchange={(e) =>
										appearanceStore.update({
											imageHeightUnit: e.currentTarget.value as AppearanceUnit
										})}
									value={p.imageHeightUnit}
								>
									{#each UNITS as unit (unit)}
										<option value={unit}>{unit}</option>
									{/each}
								</select>
							</div>
						</div>
					</div>
				{/if}

				{#if p.imageFit === 'tile'}
					{@render slider('Tile size', p.imageTileSize, 40, 1200, 'px', (v) =>
						appearanceStore.update({ imageTileSize: v })
					)}
				{/if}

				{@render slider('Zoom', p.imageScale, 50, 400, '%', (v) =>
					appearanceStore.update({ imageScale: v })
				)}

				<div class="flex flex-wrap items-start gap-4">
					<div class="space-y-1.5">
						<Label class="text-sm font-normal">Anchor</Label>

						<div class="grid w-24 grid-cols-3 gap-1">
							{#each POSITION_GRID as y (y)}
								{#each POSITION_GRID as x (x)}
									<button
										class="h-7 rounded border transition-colors {p.imagePosX === x &&
										p.imagePosY === y
											? 'border-primary bg-primary/30'
											: 'border-border/60 hover:bg-accent'}"
										aria-label="Anchor {x}% {y}%"
										onclick={() => appearanceStore.update({ imagePosX: x, imagePosY: y })}
										type="button"
									></button>
								{/each}
							{/each}
						</div>
					</div>

					<div class="min-w-48 flex-1 space-y-3">
						{@render slider('Horizontal position', p.imagePosX, 0, 100, '%', (v) =>
							appearanceStore.update({ imagePosX: v })
						)}

						{@render slider('Vertical position', p.imagePosY, 0, 100, '%', (v) =>
							appearanceStore.update({ imagePosY: v })
						)}
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-3">
					{@render slider('Opacity', p.imageOpacity, 5, 100, '%', (v) =>
						appearanceStore.update({ imageOpacity: v })
					)}

					{@render slider('Blur', p.imageBlur, 0, 40, 'px', (v) =>
						appearanceStore.update({ imageBlur: v })
					)}

					{@render slider('Brightness', p.imageBrightness, 20, 180, '%', (v) =>
						appearanceStore.update({ imageBrightness: v })
					)}
				</div>
			</div>
		{/if}
	</section>

	<section class="border-t border-border/30 pt-6">
		<Button onclick={confirmResetAll} size="sm" variant="destructive">
			<Trash2 class="h-3.5 w-3.5" />
			Remove all Appearance data
		</Button>
	</section>
</div>

<!-- full-screen preview: covers everything, any click or Escape closes it -->
{#if fullPreview}
	<div
		class="fixed inset-0 z-[10000] cursor-pointer overflow-hidden"
		style="background:var(--background);pointer-events:auto"
		onclick={() => (fullPreview = null)}
		onkeydown={() => {}}
		onpointerdown={(e) => e.stopPropagation()}
		role="presentation"
		use:portalToBody
	>
		{#if fullPreview === 'live'}
			{#key fullPreviewDoc}
				<iframe
					class="absolute inset-0 h-full w-full border-0 bg-transparent"
					style="pointer-events:none;color-scheme:normal"
					sandbox="allow-scripts"
					srcdoc={fullPreviewDoc}
					tabindex="-1"
					title="Wallpaper full-screen preview"
				></iframe>
			{/key}
		{:else}
			<div style={imageLayerStyle(p, appearanceStore.imageUrl)}></div>
		{/if}

		{#if p.dim > 0}
			<div
				class="absolute inset-0"
				style="background:var(--background);opacity:{p.dim / 100}"
			></div>
		{/if}

		<div
			class="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm shadow-lg backdrop-blur"
		>
			<X class="h-4 w-4" />
			Click anywhere or press Esc to exit the preview
		</div>
	</div>
{/if}
