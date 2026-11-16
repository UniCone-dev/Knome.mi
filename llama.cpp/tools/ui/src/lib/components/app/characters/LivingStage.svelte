<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from '@lucide/svelte';
	import { livingStore } from '$lib/stores/living.svelte';
	import LivingView from './LivingView.svelte';

	let el = $state<HTMLDivElement | null>(null);
	let drag: { dx: number; dy: number } | null = null;
	let dragging = $state(false);

	function clamp(x: number, y: number) {
		const s = livingStore.size;

		return {
			x: Math.max(0, Math.min(window.innerWidth - s, x)),
			y: Math.max(0, Math.min(window.innerHeight - s, y))
		};
	}

	function down(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button')) return;

		const r = el?.getBoundingClientRect();

		if (!r) return;

		drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
		dragging = true;
		el?.setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!drag) return;

		livingStore.pos = clamp(e.clientX - drag.dx, e.clientY - drag.dy);
	}

	function up(e: PointerEvent) {
		if (!drag) return;

		drag = null;
		dragging = false;
		el?.releasePointerCapture(e.pointerId);

		if (livingStore.pos) livingStore.setPos(livingStore.pos);
	}

	// keep it on screen when the window gets smaller
	onMount(() => {
		const fit = () => {
			if (livingStore.pos) livingStore.pos = clamp(livingStore.pos.x, livingStore.pos.y);
		};

		fit();
		window.addEventListener('resize', fit);

		return () => window.removeEventListener('resize', fit);
	});

	let place = $derived(
		livingStore.pos
			? `left: ${livingStore.pos.x}px; top: ${livingStore.pos.y}px;`
			: 'right: 16px; top: 64px;'
	);
</script>

{#if livingStore.character}
	<div
		bind:this={el}
		class="living-stage group fixed z-30 touch-none overflow-hidden rounded-3xl border border-border bg-muted shadow-lg select-none {dragging
			? 'cursor-grabbing'
			: 'cursor-grab'}"
		style="width: {livingStore.size}px; height: {livingStore.size}px; {place}"
		aria-label="{livingStore.character.name} (living character, drag to move)"
		ondragstart={(e) => e.preventDefault()}
		onpointercancel={up}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		role="img"
	>
		<LivingView />

		<button
			aria-label="Hide the living character"
			class="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-accent"
			onclick={() => livingStore.setEnabled(false)}
			type="button"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	</div>
{/if}
