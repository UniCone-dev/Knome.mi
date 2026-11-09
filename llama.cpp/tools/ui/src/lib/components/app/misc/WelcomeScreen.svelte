<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { APP_NAME, SETTINGS_KEYS } from '$lib/constants';
	import { charactersStore, settingsStore } from '$lib/stores';
	import { avatarShapeStyle } from '$lib/stores/characters/index.svelte';

	interface Props {
		/** Called once the exit animation has finished: the parent unmounts this screen. */
		onDone: () => void;
	}

	let { onDone }: Props = $props();

	const character = $derived(charactersStore.activeCharacter);
	const profileName = $derived(
		(
			(settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] as string) ||
			charactersStore.activeUserPersona?.name ||
			''
		).trim()
	);
	const profileAvatar = $derived((settingsStore.config[SETTINGS_KEYS.PROFILE_AVATAR] as string) || '');
	const shapeStyle = $derived(avatarShapeStyle(charactersStore.avatarShape));

	/**
	 * What the hero shows, in order of preference:
	 *  character  - the active AI character's picture
	 *  orb        - a character without a picture: a coloured orb with their initial
	 *  user       - no character, but the user set a profile picture
	 *  logo       - nothing to show: the Knome mark, drawn in
	 */
	const heroKind = $derived<'character' | 'orb' | 'user' | 'logo'>(
		character?.avatarUrl ? 'character' : character ? 'orb' : profileAvatar ? 'user' : 'logo'
	);
	const heroUrl = $derived(heroKind === 'character' ? (character?.avatarUrl ?? '') : profileAvatar);
	const isVideo = $derived(heroKind === 'character' && character?.avatarKind === 'video');

	// a stable colour pair per character name, for the orb and the soft backdrop
	function hueFor(name: string): number {
		let h = 0;

		for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;

		return h % 360;
	}

	const hue = $derived(hueFor(character?.name ?? profileName ?? APP_NAME));
	const initial = $derived((character?.name ?? '?').trim().charAt(0).toUpperCase());

	function greeting(): string {
		const h = new Date().getHours();

		if (h >= 5 && h < 12) return 'Good morning';
		if (h >= 12 && h < 17) return 'Good afternoon';
		if (h >= 17 && h < 22) return 'Good evening';

		return 'Still up';
	}

	const eyebrow = $derived(
		character
			? profileName
				? `${greeting()}, ${profileName}`
				: greeting()
			: profileName
				? greeting()
				: 'Welcome'
	);

	const title = $derived(
		character ? character.name : profileName ? `Welcome back, ${profileName}` : `Welcome to ${APP_NAME}`
	);

	const subtitle = $derived(
		character ? 'is ready when you are' : 'Private. Local. Yours. Everything stays on this computer.'
	);

	const chips = $derived(
		(character?.tags ?? []).filter((t: string) => t && t.toLowerCase() !== 'built-in').slice(0, 3)
	);

	const letters = $derived(Array.from(title));

	// the background shows immediately; the hero and text appear once the characters are loaded
	let ready = $state(charactersStore.isInitialized);

	$effect(() => {
		if (charactersStore.isInitialized) ready = true;
	});

	let leaving = $state(false);
	let startButton = $state<HTMLButtonElement | null>(null);

	function start() {
		if (leaving) return;

		leaving = true;
		setTimeout(onDone, 460);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			start();
		}
	}

	onMount(() => {
		// never hold the user back if loading characters is slow
		const t = setTimeout(() => (ready = true), 1500);

		return () => clearTimeout(t);
	});

	$effect(() => {
		if (ready) startButton?.focus({ preventScroll: true });
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div
	aria-label="Welcome"
	aria-modal="true"
	class="welcome"
	class:leaving
	role="dialog"
	style="--w-hue: {hue}"
>
	<!-- backdrop: the picture itself, softened, or a calm two-colour glow -->
	{#if ready && (heroKind === 'character' || heroKind === 'user')}
		{#if !isVideo}
			<div class="backdrop backdrop--image" style="background-image: url('{heroUrl}')"></div>
		{:else}
			<div class="backdrop backdrop--glow"></div>
		{/if}
	{:else}
		<div class="backdrop backdrop--glow"></div>
	{/if}

	<div class="vignette"></div>

	<!-- slow floating specks -->
	<div aria-hidden="true" class="specks">
		{#each Array.from({ length: 12 }) as _, i (i)}
			<i style="--x:{(i * 83) % 100}%; --d:{6 + (i % 5) * 1.7}s; --o:{(i % 6) * 0.45}s; --s:{3 + (i % 3) * 2}px"
			></i>
		{/each}
	</div>

	{#if ready}
	<div class="content">
		<div class="hero">
			<div class="halo"></div>
			<div class="ring" style={heroKind === 'logo' ? 'border-radius: 9999px' : shapeStyle}></div>

			<div
				class="face"
				class:face--logo={heroKind === 'logo'}
				class:face--orb={heroKind === 'orb'}
				style={heroKind === 'logo' ? 'border-radius: 9999px' : shapeStyle}
			>
				{#if heroKind === 'character' || heroKind === 'user'}
					{#if isVideo}
						<video autoplay class="media" loop muted playsinline src={heroUrl}></video>
					{:else}
						<img alt={character?.name ?? profileName} class="media" src={heroUrl} />
					{/if}
				{:else if heroKind === 'orb'}
					<span class="initial">{initial}</span>
				{:else}
					<svg class="mark" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
						<g
							fill="none"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="40"
						>
							<path class="draw" d="M168 112 V400" />
							<path class="draw draw--2" d="M358 124 L208 256 L358 388" />
						</g>
						<circle class="dot" cx="358" cy="256" r="28" fill="currentColor" />
					</svg>
				{/if}
			</div>
		</div>

		<p class="eyebrow">{eyebrow}</p>

		<h1 class="title" aria-label={title}>
			{#each letters as ch, i (i)}
				<span aria-hidden="true" class="ch" style="animation-delay: {600 + Math.min(i, 26) * 38}ms"
					>{ch === ' ' ? '\u00A0' : ch}</span
				>
			{/each}
		</h1>

		<p class="subtitle">{subtitle}</p>

		{#if chips.length > 0}
			<div class="chips">
				{#each chips as chip (chip)}
					<span class="chip">{chip}</span>
				{/each}
			</div>
		{/if}

		<button bind:this={startButton} class="cta" onclick={start} type="button">
			<span class="cta__label">Start chatting</span>
			<ArrowRight class="cta__icon" />
		</button>

		<p class="hint">Press Enter to begin · you can turn this screen off in Settings</p>
	</div>
	{/if}
</div>

<style>
	.welcome {
		position: fixed;
		inset: 0;
		z-index: 2000;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: var(--background);
		color: var(--foreground);
		animation: w-in 0.5s ease both;
		transition:
			opacity 0.45s ease,
			transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.welcome.leaving {
		opacity: 0;
		transform: scale(1.035);
		pointer-events: none;
	}

	@keyframes w-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* ---- backdrop ---- */
	.backdrop {
		position: absolute;
		inset: -12%;
		will-change: transform;
		animation:
			w-backdrop-in 1.2s ease both,
			w-drift 24s ease-in-out infinite alternate;
	}

	.backdrop--image {
		background-size: cover;
		background-position: center;
		filter: blur(64px) saturate(1.35);
		opacity: 0.5;
	}

	.backdrop--glow {
		background:
			radial-gradient(
				38% 34% at 30% 32%,
				oklch(0.7 0.16 var(--w-hue) / 0.34),
				transparent 70%
			),
			radial-gradient(
				34% 38% at 72% 70%,
				oklch(0.62 0.18 calc(var(--w-hue) + 70) / 0.28),
				transparent 70%
			);
	}

	@keyframes w-backdrop-in {
		from {
			opacity: 0;
		}
	}

	@keyframes w-drift {
		from {
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			transform: translate3d(2.5%, -2%, 0) scale(1.08);
		}
	}

	.vignette {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 50% 42%, transparent 25%, var(--background) 82%),
			linear-gradient(to bottom, transparent 55%, var(--background));
		opacity: 0.85;
		pointer-events: none;
	}

	/* ---- specks ---- */
	.specks {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.specks i {
		position: absolute;
		left: var(--x);
		bottom: -10px;
		width: var(--s);
		height: var(--s);
		border-radius: 9999px;
		background: color-mix(in oklab, var(--primary) 70%, transparent);
		opacity: 0;
		animation: w-rise var(--d) linear var(--o) infinite;
	}

	@keyframes w-rise {
		0% {
			transform: translateY(0);
			opacity: 0;
		}
		12% {
			opacity: 0.6;
		}
		100% {
			transform: translateY(-105vh);
			opacity: 0;
		}
	}

	/* ---- content ---- */
	.content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		padding: 1.5rem;
		text-align: center;
		max-width: min(92vw, 34rem);
	}

	.hero {
		position: relative;
		width: 11rem;
		height: 11rem;
		margin-bottom: 0.75rem;
		animation:
			w-hero-in 0.9s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.1s both,
			w-bob 7s ease-in-out 1s infinite;
	}

	@keyframes w-hero-in {
		from {
			opacity: 0;
			transform: scale(0.55) translateY(12px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes w-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-7px);
		}
	}

	.halo {
		position: absolute;
		inset: -28%;
		border-radius: 9999px;
		background: radial-gradient(
			circle,
			color-mix(in oklab, var(--primary) 40%, transparent),
			transparent 66%
		);
		animation: w-halo 4.5s ease-in-out infinite;
	}

	@keyframes w-halo {
		0%,
		100% {
			opacity: 0.55;
			transform: scale(0.94);
		}
		50% {
			opacity: 1;
			transform: scale(1.06);
		}
	}

	.ring {
		position: absolute;
		inset: 0;
		background: conic-gradient(
			from 0deg,
			transparent 0 14%,
			var(--primary),
			color-mix(in oklab, var(--primary) 40%, white),
			transparent 70% 100%
		);
		animation: w-spin 6s linear infinite;
	}

	@keyframes w-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.face {
		position: absolute;
		inset: 4px;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--card);
	}

	.face--orb {
		background: linear-gradient(
			135deg,
			oklch(0.66 0.17 var(--w-hue)),
			oklch(0.52 0.19 calc(var(--w-hue) + 60))
		);
	}

	.face--logo {
		background: color-mix(in oklab, var(--primary) 12%, var(--card));
		color: var(--primary);
	}

	.media {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.initial {
		font-size: 4.6rem;
		font-weight: 600;
		color: oklch(0.99 0.004 240);
		text-shadow: 0 4px 18px oklch(0 0 0 / 0.25);
	}

	.mark {
		width: 62%;
		height: 62%;
	}

	.mark .draw {
		stroke-dasharray: 520;
		stroke-dashoffset: 520;
		animation: w-draw 1.1s ease 0.5s forwards;
	}

	.mark .draw--2 {
		animation-delay: 0.85s;
	}

	.mark .dot {
		transform-origin: 358px 256px;
		transform: scale(0);
		animation: w-dot 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.5) 1.6s forwards;
	}

	@keyframes w-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes w-dot {
		to {
			transform: scale(1);
		}
	}

	/* ---- text ---- */
	.eyebrow {
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		animation: w-up 0.6s ease 0.45s both;
	}

	.title {
		font-size: clamp(1.9rem, 5.2vw, 3rem);
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.12;
	}

	.ch {
		display: inline-block;
		animation: w-letter 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
	}

	@keyframes w-letter {
		from {
			opacity: 0;
			transform: translateY(0.45em);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.subtitle {
		color: var(--muted-foreground);
		font-size: 1.05rem;
		animation: w-up 0.6s ease 1s both;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem;
		animation: w-up 0.6s ease 1.1s both;
	}

	.chip {
		padding: 0.18rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		color: var(--secondary-foreground);
		background: var(--secondary);
		border: 1px solid var(--border);
	}

	@keyframes w-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* ---- button ---- */
	.cta {
		position: relative;
		overflow: hidden;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		padding: 0.85rem 1.7rem;
		border-radius: 9999px;
		border: none;
		cursor: pointer;
		font-size: 1.02rem;
		font-weight: 600;
		color: var(--primary-foreground);
		background: var(--primary);
		box-shadow:
			0 10px 30px -10px color-mix(in oklab, var(--primary) 70%, transparent),
			inset 0 1px 0 oklch(1 0 0 / 0.25);
		animation: w-up 0.6s ease 1.25s both;
		transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.25);
	}

	.cta::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent 30%, oklch(1 0 0 / 0.38) 50%, transparent 70%);
		transform: translateX(-120%);
		animation: w-sheen 3.6s ease-in-out 2.2s infinite;
	}

	@keyframes w-sheen {
		0% {
			transform: translateX(-120%);
		}
		45%,
		100% {
			transform: translateX(120%);
		}
	}

	.cta:hover {
		transform: translateY(-2px) scale(1.04);
	}

	.cta:active {
		transform: scale(0.97);
	}

	.cta:focus-visible {
		outline: 3px solid color-mix(in oklab, var(--primary) 50%, transparent);
		outline-offset: 3px;
	}

	.cta :global(.cta__icon) {
		width: 1.15rem;
		height: 1.15rem;
		transition: transform 0.25s ease;
	}

	.cta:hover :global(.cta__icon) {
		transform: translateX(4px);
	}

	.hint {
		margin-top: 0.4rem;
		font-size: 0.78rem;
		color: var(--muted-foreground);
		opacity: 0.8;
		animation: w-up 0.6s ease 1.6s both;
	}

	@media (prefers-reduced-motion: reduce) {
		.welcome,
		.welcome * {
			animation: none !important;
		}
		.mark .draw {
			stroke-dashoffset: 0;
		}
		.mark .dot {
			transform: none;
		}
	}
</style>
