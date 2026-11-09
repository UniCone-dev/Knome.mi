<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import MessengerAvatar from './MessengerAvatar.svelte';
	import MessengerTools from './MessengerTools.svelte';
	import { APP_NAME } from '$lib/constants';
	import {
		charactersStore,
		chatStore,
		conversationsStore,
		messengerStore,
		uiStore
	} from '$lib/stores';
	import { formatChatTime, resolveContact } from '$lib/stores/messenger.svelte';

	const messenger = $derived(charactersStore.isWhatsappMode);
	const conv = $derived(conversationsStore.activeConversation);
	const persona = $derived(charactersStore.activeUserPersona);
	const typing = $derived(chatStore.isStreaming());

	const contact = $derived(
		resolveContact(conv, charactersStore.characters, charactersStore.activeCharacterId, messenger)
	);
	const chats = $derived(messengerStore.chatsFor(contact?.id));

	// Messenger layout: opening a chat makes its character the active one (so replies use that
	// character). Only when the open chat itself changes, never while a contact click is in flight.
	let lastSyncedConv: string | undefined | null = undefined;

	$effect(() => {
		if (!messenger) return;

		const id = conv?.id ?? null;

		if (id === lastSyncedConv) return;

		lastSyncedConv = id;

		if (conv && conv.characterId && conv.characterId !== charactersStore.activeCharacterId) {
			charactersStore.setActiveCharacter(conv.characterId);
		} else if (conv && !conv.characterId && charactersStore.activeCharacterId) {
			charactersStore.setActiveCharacter(undefined);
		}
	});

	const subtitle = $derived.by(() => {
		if (typing) return null;
		if (persona?.name && contact && !contact.general) return `as ${persona.name}`;
		if (chats.length === 0) return 'No chats yet';

		return `${chats.length} ${chats.length === 1 ? 'chat' : 'chats'} · last ${formatChatTime(chats[0].lastModified)}`;
	});
</script>

{#if messenger || charactersStore.showChatHeader}
	<div class="chat-character-header" class:messenger>
		{#if messenger}
			<button
				aria-label="Back to chats"
				class="chat-character-header__back md:hidden"
				onclick={() => (uiStore.isSidebarExpanded = true)}
				type="button"
			>
				<ChevronLeft class="h-5 w-5" />
			</button>
		{/if}

		<button
			aria-label="Open contact info"
			class="chat-character-header__main"
			onclick={() => messengerStore.openInfo()}
			type="button"
		>
			<MessengerAvatar
				kind={contact?.kind}
				name={contact?.name ?? APP_NAME}
				size={40}
				url={contact?.url}
			/>

			<span class="min-w-0 flex-1 text-left">
				<span class="block truncate text-sm font-semibold">{contact?.name ?? APP_NAME}</span>

				{#if typing}
					<span class="chat-character-header__typing block text-xs">
						typing<span>.</span><span>.</span><span>.</span>
					</span>
				{:else if subtitle}
					<span class="block truncate text-xs text-muted-foreground">{subtitle}</span>
				{/if}
			</span>

			<ChevronRight class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
		</button>

		{#if messenger && conv}
			<MessengerTools />
		{/if}
	</div>
{/if}

<style>
	.chat-character-header {
		position: sticky;
		top: 0.5rem;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 0.25rem 0 0.75rem;
		padding: 0.3rem 0.5rem 0.3rem 0.3rem;
		border-radius: 1.25rem;
		background: var(--k-glass, color-mix(in oklab, var(--background) 82%, transparent));
		border: 1px solid var(--k-glass-border, var(--border));
		box-shadow: var(--k-glass-shadow, 0 6px 20px rgb(0 0 0 / 0.06));
	}

	@media (min-width: 768px) {
		.chat-character-header {
			top: calc(0.5rem + var(--chat-tabs-offset, 0px) * 2.64);
		}
	}

	.chat-character-header__main {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: center;
		gap: 0.75rem;
		padding: 0.15rem 0.4rem;
		border-radius: 1rem;
		transition: background-color 0.18s ease;
	}

	.chat-character-header__main:hover {
		background: color-mix(in oklab, var(--accent) 60%, transparent);
	}

	:global(.chat-character-tool) {
		display: flex;
		height: 2.25rem;
		width: 2.25rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: var(--muted-foreground);
		transition: background-color 0.18s ease;
	}

	:global(.chat-character-tool:hover) {
		background: color-mix(in oklab, var(--accent) 60%, transparent);
	}

	.chat-character-header__back {
		display: flex;
		height: 2.25rem;
		width: 2.25rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: var(--muted-foreground);
	}

	.chat-character-header__typing {
		color: var(--primary);
	}

	.chat-character-header__typing span {
		animation: k-typing 1.2s infinite both;
	}

	.chat-character-header__typing span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.chat-character-header__typing span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes k-typing {
		0%,
		80%,
		100% {
			opacity: 0.2;
		}
		40% {
			opacity: 1;
		}
	}
</style>
