<script lang="ts">
	// The app-wide custom background (Settings > Appearance). One fixed layer behind everything:
	// the live wallpaper (sandboxed iframe) or the uploaded image, plus an optional readability dim.
	// It never touches the interface itself; it only takes the place of the theme's own background.
	import { onMount } from 'svelte';
	import { imageLayerStyle, appearanceStore } from '$lib/stores/appearance.svelte';
	import { portalToBody } from '$lib/utils/portal-to-body';

	let p = $derived(appearanceStore.prefs);
	let active = $derived(appearanceStore.active);

	onMount(() => {
		void appearanceStore.init();
	});

	// html attributes switch the CSS in styles/knome-appearance.css (transparent body, theme layers hidden)
	$effect(() => {
		const root = document.documentElement;

		if (active) {
			root.setAttribute('data-appearance', p.mode);

			if (p.hideThemeBackground) root.setAttribute('data-appearance-hide-theme', '');
			else root.removeAttribute('data-appearance-hide-theme');
		} else {
			root.removeAttribute('data-appearance');
			root.removeAttribute('data-appearance-hide-theme');
		}

		return () => {
			root.removeAttribute('data-appearance');
			root.removeAttribute('data-appearance-hide-theme');
		};
	});
</script>

{#if active}
	<div class="knome-appearance-layer" aria-hidden="true" use:portalToBody>
		{#if p.mode === 'image'}
			<div style={imageLayerStyle(p, appearanceStore.imageUrl)}></div>
		{:else if p.mode === 'live'}
			{#key appearanceStore.liveDoc}
				<iframe
					class="knome-appearance-frame"
					sandbox="allow-scripts"
					srcdoc={appearanceStore.liveDoc}
					style:opacity={p.liveOpacity / 100}
					style:filter={p.liveBlur > 0 ? `blur(${p.liveBlur}px)` : undefined}
					style:inset={p.liveBlur > 0 ? `${-p.liveBlur * 2}px` : undefined}
					tabindex="-1"
					title="Live wallpaper"
				></iframe>
			{/key}
		{/if}

		{#if p.dim > 0}
			<div class="knome-appearance-dim" style:opacity={p.dim / 100}></div>
		{/if}
	</div>
{/if}
