<script lang="ts">
	import { MessageCirclePlus, Search, Settings2, Trash2, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import MessengerAvatar from './MessengerAvatar.svelte';
	import { RouterService } from '$lib/services/router.service';
	import { charactersStore, conversationsStore, messengerStore } from '$lib/stores';
	import {
		formatChatTime,
		GENERAL_CONTACT_ID,
		resolveContact
	} from '$lib/stores/messenger.svelte';

	const contact = $derived(
		resolveContact(
			conversationsStore.activeConversation,
			charactersStore.characters,
			charactersStore.activeCharacterId,
			charactersStore.isWhatsappMode
		)
	);

	const chats = $derived(messengerStore.chatsFor(contact?.id));
	let filter = $state('');
	let confirmDelete = $state<string | null>(null);

	const shown = $derived.by(() => {
		const q = filter.trim().toLowerCase();

		if (!q) return chats;

		return chats.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				(messengerStore.preview(c)?.text ?? '').toLowerCase().includes(q)
		);
	});

	// previews are loaded lazily, only while the panel is open
	$effect(() => {
		if (!messengerStore.infoOpen) return;

		for (const c of chats) messengerStore.ensurePreview(c);
	});

	// leaving the panel resets its little bits of state
	$effect(() => {
		if (!messengerStore.infoOpen) {
			filter = '';
			confirmDelete = null;
		}
	});

	function close() {
		messengerStore.closeInfo();
	}

	async function openChat(id: string) {
		close();
		await goto(RouterService.chat(id));
	}

	async function newChat() {
		if (!contact) return;

		messengerStore.autoOpened = true;
		charactersStore.setActiveCharacter(contact.general ? undefined : contact.id);
		conversationsStore.clearActiveConversation();
		close();
		await goto('#/');
	}

	async function remove(id: string) {
		if (confirmDelete !== id) {
			confirmDelete = id;

			return;
		}

		confirmDelete = null;
		await conversationsStore.deleteConversation(id);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && messengerStore.infoOpen) {
			e.preventDefault();
			close();
		}
	}

	const tags = $derived(
		(contact?.character?.tags ?? []).filter((t: string) => t && t.toLowerCase() !== 'built-in')
	);
</script>

<svelte:window onkeydown={onKeydown} />

{#if messengerStore.infoOpen && contact}
	<button aria-label="Close" class="info-backdrop" onclick={close} tabindex="-1" type="button"></button>

	<aside aria-label="Contact info" aria-modal="true" class="info-panel" role="dialog">
		<div class="flex items-center gap-2 px-3 pt-3 pb-1">
			<button aria-label="Close" class="info-icon-btn" onclick={close} type="button">
				<X class="h-5 w-5" />
			</button>
			<h3 class="flex-1 text-base font-semibold">Contact info</h3>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto pb-6">
			<!-- profile -->
			<div class="flex flex-col items-center gap-2 px-6 pt-4 pb-5 text-center">
				<div class="info-hero">
					<MessengerAvatar kind={contact.kind} name={contact.name} size={120} url={contact.url} />
				</div>

				<h2 class="mt-2 text-2xl font-semibold tracking-tight">{contact.name}</h2>

				<p class="text-sm text-muted-foreground">
					{chats.length}
					{chats.length === 1 ? 'chat' : 'chats'}
				</p>

				<div class="mt-2 flex gap-2">
					<button class="info-action info-action--primary" onclick={newChat} type="button">
						<MessageCirclePlus class="h-4 w-4" /> New chat
					</button>

					{#if !contact.general}
						<button
							class="info-action"
							onclick={() => {
								close();
								messengerStore.requestCharactersDialog();
							}}
							type="button"
						>
							<Settings2 class="h-4 w-4" /> Edit
						</button>
					{/if}
				</div>
			</div>

			<!-- about -->
			{#if contact.character?.description || tags.length > 0}
				<section class="info-card">
					<h4 class="info-card__title">About</h4>

					{#if contact.character?.description}
						<p class="whitespace-pre-line text-sm leading-relaxed">{contact.character.description}</p>
					{/if}

					{#if tags.length > 0}
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each tags as tag (tag)}
								<span class="info-chip">{tag}</span>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			{#if contact.general}
				<section class="info-card">
					<h4 class="info-card__title">About</h4>
					<p class="text-sm leading-relaxed text-muted-foreground">
						Chats you had before characters were tracked per chat. They are all still here.
					</p>
				</section>
			{/if}

			<!-- chats -->
			<section class="px-3 pt-4">
				<div class="flex items-center justify-between px-3 pb-2">
					<h4 class="info-card__title !mb-0">Chats</h4>
				</div>

				{#if chats.length > 5}
					<label class="info-search mx-3 mb-2">
						<Search class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
						<input
							aria-label="Search these chats"
							bind:value={filter}
							class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							placeholder="Search chats"
						/>
					</label>
				{/if}

				{#if chats.length === 0}
					<p class="px-3 py-6 text-center text-sm text-muted-foreground">
						No chats yet. Send a message to start one.
					</p>
				{:else if shown.length === 0}
					<p class="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches.</p>
				{:else}
					<ul class="flex flex-col">
						{#each shown as c (c.id)}
							{@const p = messengerStore.preview(c)}
							<li class="group relative">
								<button
									class="info-chat"
									class:active={conversationsStore.activeConversation?.id === c.id}
									onclick={() => openChat(c.id)}
									type="button"
								>
									<div class="flex items-baseline justify-between gap-3">
										<span class="truncate text-sm font-medium">{c.name}</span>
										<span class="flex-shrink-0 text-xs text-muted-foreground">
											{formatChatTime(c.lastModified)}
										</span>
									</div>

									<p class="mt-0.5 truncate pr-8 text-xs text-muted-foreground">
										{#if p?.text}
											{p.role === 'user' ? 'You: ' : ''}{p.text}
										{:else}
											&nbsp;
										{/if}
									</p>
								</button>

								<button
									aria-label={confirmDelete === c.id ? 'Confirm delete' : 'Delete chat'}
									class="info-delete"
									class:confirm={confirmDelete === c.id}
									onclick={() => remove(c.id)}
									onblur={() => (confirmDelete = null)}
									type="button"
								>
									{#if confirmDelete === c.id}
										Delete?
									{:else}
										<Trash2 class="h-4 w-4" />
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	</aside>
{/if}

<style>
	.info-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: oklch(0 0 0 / 0.35);
		animation: info-fade 0.2s ease both;
		cursor: default;
	}

	.info-panel {
		position: fixed;
		z-index: 61;
		top: 0.5rem;
		right: 0.5rem;
		bottom: 0.5rem;
		display: flex;
		width: 26rem;
		max-width: calc(100vw - 1rem);
		flex-direction: column;
		border-radius: 1.25rem;
		background: var(--popover);
		color: var(--popover-foreground);
		border: 1px solid var(--border);
		box-shadow: 0 24px 70px -20px oklch(0 0 0 / 0.5);
		animation: info-slide 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@media (max-width: 767px) {
		.info-panel {
			inset: 0;
			width: auto;
			max-width: none;
			border-radius: 0;
		}
	}

	@keyframes info-slide {
		from {
			opacity: 0;
			transform: translateX(28px);
		}
	}

	@keyframes info-fade {
		from {
			opacity: 0;
		}
	}

	.info-hero {
		animation: info-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.1s both;
	}

	@keyframes info-pop {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
	}

	.info-icon-btn {
		display: flex;
		height: 2.25rem;
		width: 2.25rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: var(--muted-foreground);
		transition: background-color 0.18s ease;
	}

	.info-icon-btn:hover {
		background: var(--accent);
		color: var(--accent-foreground);
	}

	.info-action {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--border);
		transition:
			transform 0.18s ease,
			background-color 0.18s ease;
	}

	.info-action:hover {
		transform: translateY(-1px);
		background: var(--accent);
	}

	.info-action--primary {
		background: var(--primary);
		color: var(--primary-foreground);
		border-color: transparent;
	}

	.info-action--primary:hover {
		background: color-mix(in oklab, var(--primary) 90%, white);
	}

	.info-card {
		margin: 0 1rem 0.5rem;
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		background: var(--muted);
	}

	.info-card__title {
		margin-bottom: 0.4rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.info-chip {
		padding: 0.15rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		background: var(--secondary);
		border: 1px solid var(--border);
	}

	.info-search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.8rem;
		border-radius: 9999px;
		background: var(--muted);
	}

	.info-search input {
		border: 0;
		box-shadow: none;
		padding: 0;
		background: transparent;
	}

	.info-search input:focus {
		outline: none;
		box-shadow: none;
	}

	.info-chat {
		display: block;
		width: 100%;
		padding: 0.65rem 0.75rem;
		border-radius: 0.8rem;
		text-align: left;
		transition: background-color 0.16s ease;
	}

	.info-chat:hover {
		background: color-mix(in oklab, var(--accent) 65%, transparent);
	}

	.info-chat.active {
		background: var(--accent);
	}

	.info-delete {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		height: 1.9rem;
		min-width: 1.9rem;
		align-items: center;
		justify-content: center;
		padding: 0 0.4rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		opacity: 0;
		transition:
			opacity 0.16s ease,
			background-color 0.16s ease;
	}

	li:hover .info-delete,
	.info-delete:focus-visible,
	.info-delete.confirm {
		opacity: 1;
	}

	.info-delete:hover {
		background: color-mix(in oklab, var(--destructive) 15%, transparent);
		color: var(--destructive);
	}

	.info-delete.confirm {
		background: var(--destructive);
		color: white;
	}

	@media (prefers-reduced-motion: reduce) {
		.info-panel,
		.info-backdrop,
		.info-hero {
			animation: none;
		}
	}
</style>
