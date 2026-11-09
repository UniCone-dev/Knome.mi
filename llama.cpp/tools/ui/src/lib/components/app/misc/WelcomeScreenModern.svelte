<script lang="ts">
	import {
		ArrowRight,
		BrainCircuit,
		ChevronDown,
		Code,
		EyeOff,
		FileText,
		Lightbulb,
		Lock,
		MessageCircle,
		Palette,
		Repeat,
		Sparkles,
		Users,
		Wrench
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { APP_NAME, SETTINGS_KEYS } from '$lib/constants';
	import { charactersStore, settingsStore } from '$lib/stores';

	interface Props {
		/** Called once the exit animation has finished: the parent unmounts this screen. */
		onDone: () => void;
	}

	let { onDone }: Props = $props();

	const profileName = $derived(
		((settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] as string) || '').trim()
	);
	const character = $derived(charactersStore.activeCharacter);

	function greeting(): string {
		const h = new Date().getHours();

		if (h >= 5 && h < 12) return 'Good morning';
		if (h >= 12 && h < 17) return 'Good afternoon';
		if (h >= 17 && h < 22) return 'Good evening';

		return 'Hello';
	}

	const headline = $derived(
		profileName ? `${greeting()}, ${profileName}` : `Welcome to ${APP_NAME}`
	);

	const prompts = $derived([
		{ icon: Lightbulb, label: 'Brainstorm ideas', text: 'Help me brainstorm ideas for ' },
		{ icon: Code, label: 'Write or fix code', text: 'Help me write code that ' },
		{ icon: FileText, label: 'Summarise a text', text: 'Summarise the following text:\n\n' },
		{
			icon: Sparkles,
			label: character ? `Say hi to ${character.name}` : 'Just chat',
			text: character ? `Hi ${character.name}!` : 'Hi! '
		}
	]);

	const features = [
		{
			icon: Lock,
			title: 'Private by design',
			text: 'The model runs on your computer. Chats, profile and settings never leave it.'
		},
		{
			icon: Users,
			title: 'Characters',
			text: 'Create AI characters with a face and a personality, and keep a separate chat history for each.'
		},
		{
			icon: BrainCircuit,
			title: 'DeepMind mode',
			text: 'Let the character become the AI itself, with no roleplay framing and no prompt to manage.'
		},
		{
			icon: MessageCircle,
			title: 'Messenger layout',
			text: 'A chat-app look with contacts, typing indicator and one thread per character.'
		},
		{
			icon: Wrench,
			title: 'Tools and thinking',
			text: 'Watch the reasoning in a side panel, or hide it. Connect tools and let the AI use them.'
		},
		{
			icon: Palette,
			title: 'Make it yours',
			text: 'Themes, live animated wallpapers written in HTML, CSS and JS, or your own background image.'
		},
		{
			icon: EyeOff,
			title: 'Hide chats',
			text: 'Tuck private conversations away and bring them back whenever you want.'
		},
		{
			icon: Repeat,
			title: 'Import and export',
			text: 'Move chats between devices. Imported chats fit themselves to the right character.'
		}
	];

	const steps = [
		{
			n: '1',
			title: 'Start the server',
			text: 'Run llama-server with a model from your models folder.'
		},
		{
			n: '2',
			title: 'Pick a model',
			text: 'Choose it from the model selector next to the message box.'
		},
		{
			n: '3',
			title: 'Start talking',
			text: 'Ask anything, or choose a character and chat as yourself.'
		}
	];

	let leaving = $state(false);
	let root = $state<HTMLDivElement | null>(null);
	let aboutEl = $state<HTMLElement | null>(null);
	let showAgain = $state(settingsStore.config[SETTINGS_KEYS.WELCOME_SCREEN] !== false);

	function start(text?: string) {
		if (leaving) return;

		leaving = true;
		settingsStore.updateConfig(SETTINGS_KEYS.WELCOME_SCREEN, showAgain);

		setTimeout(() => {
			onDone();

			if (text) {
				setTimeout(() => {
					const box = document.querySelector<HTMLTextAreaElement>(
						'.conversation-chat-form textarea'
					);

					if (!box) return;

					box.value = text;
					box.dispatchEvent(new Event('input', { bubbles: true }));
					box.focus();
					box.setSelectionRange(text.length, text.length);
				}, 150);
			}
		}, 420);
	}

	function scrollToAbout() {
		aboutEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			start();
		} else if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
			e.preventDefault();
			start();
		}
	}

	onMount(() => {
		if (!root) return;

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.classList.add('in');
						io.unobserve(entry.target);
					}
				}
			},
			{ root, threshold: 0.15 }
		);

		root.querySelectorAll('.reveal').forEach((el) => io.observe(el));

		return () => io.disconnect();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div
	bind:this={root}
	aria-label="Welcome"
	aria-modal="true"
	class="wm"
	class:leaving
	role="dialog"
	tabindex="-1"
>
	<div class="wm-bg" aria-hidden="true">
		<i class="blob b1"></i>
		<i class="blob b2"></i>
		<i class="blob b3"></i>
		<div class="grain"></div>
	</div>

	<!-- 1. hero -->
	<section class="hero">
		<div class="brand">
			<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<g
					fill="none"
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="44"
				>
					<path d="M168 112 V400" />
					<path d="M358 124 L208 256 L358 388" />
				</g>
				<circle cx="358" cy="256" r="30" fill="currentColor" />
			</svg>

			<span>{APP_NAME}</span>
		</div>

		<h1 class="headline">{headline}</h1>
		<p class="tagline">Your own AI. Private, local and yours to shape.</p>

		<button class="cta" onclick={() => start()} type="button">
			Start chatting
			<ArrowRight class="h-4.5 w-4.5" />
		</button>

		<div class="prompts">
			{#each prompts as p (p.label)}
				<button class="prompt" onclick={() => start(p.text)} type="button">
					<p.icon class="h-4 w-4" />
					{p.label}
				</button>
			{/each}
		</div>

		<button aria-label="Learn about {APP_NAME}" class="more" onclick={scrollToAbout} type="button">
			<span>What is {APP_NAME}?</span>
			<ChevronDown class="h-5 w-5" />
		</button>
	</section>

	<!-- 2. about -->
	<section bind:this={aboutEl} class="about">
		<div class="reveal">
			<p class="kicker">About {APP_NAME}</p>
			<h2>An AI that lives on your computer</h2>
			<p class="lead">
				{APP_NAME} is a fast, private chat interface for local language models, built on llama.cpp. No
				account, no cloud and no tracking: you choose the model, the character and the look.
			</p>
		</div>

		<div class="grid">
			{#each features as f, i (f.title)}
				<article class="card reveal" style="--i:{i % 4}">
					<span class="ico"><f.icon class="h-5 w-5" /></span>
					<h3>{f.title}</h3>
					<p>{f.text}</p>
				</article>
			{/each}
		</div>

		<div class="reveal">
			<p class="kicker">Getting started</p>
			<h2>Three steps</h2>
		</div>

		<ol class="steps">
			{#each steps as s, i (s.n)}
				<li class="step reveal" style="--i:{i}">
					<span class="num">{s.n}</span>
					<div>
						<h3>{s.title}</h3>
						<p>{s.text}</p>
					</div>
				</li>
			{/each}
		</ol>

		<div class="final reveal">
			<button class="cta" onclick={() => start()} type="button">
				Start chatting
				<ArrowRight class="h-4.5 w-4.5" />
			</button>

			<label class="again">
				<input bind:checked={showAgain} type="checkbox" />
				Show this screen when I open {APP_NAME}
			</label>

			<p class="fine">You can switch to the classic welcome screen in Settings &gt; Profile.</p>
		</div>
	</section>
</div>

<style>
	.wm {
		position: fixed;
		inset: 0;
		z-index: 2000;
		overflow-y: auto;
		overflow-x: hidden;
		scroll-behavior: smooth;
		scroll-snap-type: y proximity;
		background: var(--background);
		color: var(--foreground);
		animation: wm-in 0.5s ease both;
		transition:
			opacity 0.4s ease,
			transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.wm.leaving {
		opacity: 0;
		transform: scale(1.02);
		pointer-events: none;
	}

	@keyframes wm-in {
		from {
			opacity: 0;
		}
	}

	/* ---------- background ---------- */
	.wm-bg {
		position: fixed;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.blob {
		position: absolute;
		border-radius: 9999px;
		filter: blur(90px);
		opacity: 0.5;
		animation: wm-float 22s ease-in-out infinite alternate;
	}

	.b1 {
		width: 46vmax;
		height: 46vmax;
		left: -12vmax;
		top: -14vmax;
		background: color-mix(in oklab, var(--primary) 42%, transparent);
	}

	.b2 {
		width: 38vmax;
		height: 38vmax;
		right: -10vmax;
		top: 18vh;
		background: oklch(0.7 0.16 320 / 0.3);
		animation-delay: -7s;
	}

	.b3 {
		width: 34vmax;
		height: 34vmax;
		left: 24vw;
		bottom: -22vmax;
		background: oklch(0.75 0.13 195 / 0.28);
		animation-delay: -13s;
	}

	@keyframes wm-float {
		to {
			transform: translate3d(4vmax, 3vmax, 0) scale(1.1);
		}
	}

	.grain {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 0%, transparent 40%, var(--background) 100%);
		opacity: 0.55;
	}

	/* ---------- hero ---------- */
	.hero {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.1rem;
		padding: 3rem 1.5rem 5rem;
		text-align: center;
		scroll-snap-align: start;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1.2rem;
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--primary);
		animation: wm-up 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.brand svg {
		width: 2rem;
		height: 2rem;
	}

	.headline {
		max-width: 20ch;
		font-size: clamp(2.3rem, 6.4vw, 4.4rem);
		font-weight: 650;
		letter-spacing: -0.035em;
		line-height: 1.05;
		text-wrap: balance;
		background: linear-gradient(
			120deg,
			var(--foreground) 35%,
			color-mix(in oklab, var(--primary) 80%, var(--foreground))
		);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		animation: wm-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.08s both;
	}

	.tagline {
		font-size: clamp(1.02rem, 2.2vw, 1.3rem);
		color: var(--muted-foreground);
		animation: wm-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.16s both;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.6rem;
		padding: 0.95rem 1.9rem;
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--primary-foreground);
		background: var(--primary);
		box-shadow:
			0 14px 34px -14px color-mix(in oklab, var(--primary) 80%, transparent),
			inset 0 1px 0 oklch(1 0 0 / 0.22);
		transition:
			transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 0.2s ease;
		animation: wm-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.24s both;
	}

	.cta:hover {
		transform: translateY(-2px);
		box-shadow:
			0 20px 40px -14px color-mix(in oklab, var(--primary) 85%, transparent),
			inset 0 1px 0 oklch(1 0 0 / 0.22);
	}

	.cta:active {
		transform: scale(0.97);
	}

	.cta:focus-visible,
	.prompt:focus-visible,
	.more:focus-visible {
		outline: 3px solid color-mix(in oklab, var(--primary) 45%, transparent);
		outline-offset: 3px;
	}

	.prompts {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
		max-width: 40rem;
		margin-top: 0.8rem;
		animation: wm-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.32s both;
	}

	.prompt {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 1rem;
		border-radius: 9999px;
		font-size: 0.9rem;
		cursor: pointer;
		color: var(--foreground);
		background: color-mix(in oklab, var(--card) 70%, transparent);
		border: 1px solid var(--border);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			background-color 0.18s ease;
	}

	.prompt:hover {
		transform: translateY(-2px);
		border-color: color-mix(in oklab, var(--primary) 50%, var(--border));
		background: color-mix(in oklab, var(--primary) 8%, var(--card));
	}

	.more {
		position: absolute;
		bottom: 1.6rem;
		left: 50%;
		translate: -50% 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		font-size: 0.85rem;
		color: var(--muted-foreground);
		cursor: pointer;
		background: none;
		border: none;
		animation: wm-up 0.8s ease 0.6s both;
	}

	.more:hover {
		color: var(--foreground);
	}

	.more :global(svg) {
		animation: wm-bounce 2s ease-in-out infinite;
	}

	@keyframes wm-bounce {
		50% {
			transform: translateY(4px);
		}
	}

	@keyframes wm-up {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}

	/* ---------- about ---------- */
	.about {
		position: relative;
		max-width: 62rem;
		margin: 0 auto;
		padding: 5rem 1.5rem 6rem;
		display: flex;
		flex-direction: column;
		gap: 2.6rem;
		scroll-snap-align: start;
	}

	.kicker {
		margin-bottom: 0.5rem;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--primary);
	}

	h2 {
		font-size: clamp(1.7rem, 4vw, 2.6rem);
		font-weight: 650;
		letter-spacing: -0.025em;
		line-height: 1.12;
	}

	.lead {
		max-width: 44rem;
		margin-top: 1rem;
		font-size: 1.1rem;
		line-height: 1.65;
		color: var(--muted-foreground);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
		gap: 1rem;
	}

	.card {
		padding: 1.25rem;
		border-radius: 1.25rem;
		background: color-mix(in oklab, var(--card) 72%, transparent);
		border: 1px solid var(--border);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transition:
			transform 0.25s ease,
			border-color 0.25s ease;
	}

	.card:hover {
		transform: translateY(-3px);
		border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
	}

	.ico {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		margin-bottom: 0.9rem;
		border-radius: 0.8rem;
		color: var(--primary);
		background: color-mix(in oklab, var(--primary) 12%, transparent);
	}

	.card h3,
	.step h3 {
		font-size: 1.02rem;
		font-weight: 600;
		margin-bottom: 0.3rem;
	}

	.card p,
	.step p {
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--muted-foreground);
	}

	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.step {
		display: flex;
		gap: 0.9rem;
		padding: 1.2rem;
		border-radius: 1.25rem;
		border: 1px dashed color-mix(in oklab, var(--border) 90%, var(--foreground));
	}

	.num {
		flex: none;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		font-weight: 650;
		color: var(--primary-foreground);
		background: var(--primary);
	}

	.final {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		padding: 2.6rem 1.5rem;
		border-radius: 1.75rem;
		text-align: center;
		background: color-mix(in oklab, var(--primary) 8%, var(--card));
		border: 1px solid color-mix(in oklab, var(--primary) 25%, var(--border));
	}

	.final .cta {
		animation: none;
		margin-top: 0;
	}

	.again {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.fine {
		font-size: 0.8rem;
		color: var(--muted-foreground);
		opacity: 0.85;
	}

	/* ---------- reveal on scroll ---------- */
	.reveal {
		opacity: 0;
		transform: translateY(18px);
		transition:
			opacity 0.6s ease calc(var(--i, 0) * 70ms),
			transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i, 0) * 70ms);
	}

	.reveal:global(.in) {
		opacity: 1;
		transform: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.wm,
		.wm * {
			animation: none !important;
			scroll-behavior: auto;
		}

		.reveal {
			opacity: 1;
			transform: none;
			transition: none;
		}
	}
</style>
