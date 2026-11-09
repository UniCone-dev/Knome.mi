<script lang="ts">
	import ChatMessageAvatar from '$lib/components/app/chat/ChatMessages/ChatMessage/ChatMessageAvatar.svelte';
	import { charactersStore, serverStore, settingsStore } from '$lib/stores';
	import { APP_NAME, SETTINGS_KEYS } from '$lib/constants';

	interface Props {
		isEmpty: boolean;
	}

	let { isEmpty = false }: Props = $props();

	let profileName = $derived((settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] as string) || '');
	let showStartScreen = $derived(
		Boolean(settingsStore.config[SETTINGS_KEYS.SHOW_START_SCREEN] ?? true)
	);

	// the active character's picture above the headline (goes with the welcome screen setting)
	let heroCharacter = $derived(
		settingsStore.config[SETTINGS_KEYS.WELCOME_SCREEN] !== false
			? charactersStore.activeCharacter
			: undefined
	);

	let hint = $derived(
		serverStore.props?.modalities?.audio
			? 'Speak or type to begin your session'
			: 'Begin by typing a message or attach a file'
	);

	function focusChatInput() {
		const el = document.querySelector<HTMLElement>(
			'.conversation-chat-form textarea, .conversation-chat-form [contenteditable="true"]'
		);

		el?.focus();
	}
</script>

<div
	class={[
		'mb-4 hidden px-4 text-center text-balance',
		isEmpty && 'mb-[calc(50dvh-8rem)] md:mb-8 block!'
	]}
>
	{#if showStartScreen}
		{#if heroCharacter?.avatarUrl}
			<div class="start-hero mx-auto mb-4 w-fit">
				<ChatMessageAvatar
					alt={heroCharacter.name}
					avatarKind={heroCharacter.avatarKind}
					avatarUrl={heroCharacter.avatarUrl}
					shape={charactersStore.avatarShape}
					size={88}
				/>
			</div>
		{/if}

		<button
			class="pointer-events-auto mx-auto block cursor-text"
			onclick={focusChatInput}
			type="button"
		>
			<h1 class="mb-2 text-2xl font-semibold tracking-tight md:text-4xl">
				{#if profileName}
					Welcome back, <span class="text-gradient-knome">{profileName}</span>
				{:else}
					Start a <span class="text-gradient-knome">Conversation</span>
				{/if}
			</h1>
		</button>

		<p class="pointer-events-none text-muted-foreground md:text-lg">{hint}</p>
	{:else}
		<div class="pointer-events-none">
			<h1 class="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
				{APP_NAME} is synchronized
			</h1>

			<p class="text-muted-foreground md:text-lg">{hint}</p>
		</div>
	{/if}
</div>

<style>
	.start-hero {
		animation: start-hero-in 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}

	@keyframes start-hero-in {
		from {
			opacity: 0;
			transform: scale(0.7) translateY(10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.start-hero {
			animation: none;
		}
	}
</style>
