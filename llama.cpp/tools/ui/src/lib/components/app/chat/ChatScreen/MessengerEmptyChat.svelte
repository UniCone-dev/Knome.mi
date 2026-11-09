<script lang="ts">
	// Messenger layout's "no messages yet" state: replaces the "Start a Conversation" headline with
	// the contact you are about to talk to.
	import { Users } from '@lucide/svelte';
	import MessengerAvatar from './MessengerAvatar.svelte';
	import { charactersStore, conversationsStore, messengerStore } from '$lib/stores';
	import { resolveContact } from '$lib/stores/messenger.svelte';

	interface Props {
		isEmpty: boolean;
	}

	let { isEmpty }: Props = $props();

	const contact = $derived(
		resolveContact(
			conversationsStore.activeConversation,
			charactersStore.characters,
			charactersStore.activeCharacterId,
			true
		)
	);

	const blurb = $derived(
		(contact?.character?.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 170)
	);
</script>

{#if isEmpty}
	<div class="messenger-empty mx-auto mb-6 flex w-full max-w-xl flex-col items-center gap-3 text-center">
		{#if contact}
			<MessengerAvatar kind={contact.kind} name={contact.name} size={96} url={contact.url} />

			<h1 class="text-2xl font-semibold tracking-tight">{contact.name}</h1>

			{#if blurb}
				<p class="max-w-md text-sm text-muted-foreground">{blurb}{blurb.length >= 170 ? '…' : ''}</p>
			{/if}

			<p class="text-sm text-muted-foreground">No messages yet. Say hi below.</p>
		{:else}
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
				<Users class="h-8 w-8" />
			</div>

			<h1 class="text-xl font-semibold tracking-tight">Pick a character to chat with</h1>

			<p class="max-w-sm text-sm text-muted-foreground">
				In Messenger layout every chat belongs to a character. Choose one from the list, or create a
				new one.
			</p>

			<button
				class="mt-1 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
				onclick={() => messengerStore.requestCharactersDialog()}
				type="button"
			>
				Open characters
			</button>
		{/if}
	</div>
{/if}

<style>
	.messenger-empty {
		animation: messenger-empty-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes messenger-empty-in {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.messenger-empty {
			animation: none;
		}
	}
</style>
