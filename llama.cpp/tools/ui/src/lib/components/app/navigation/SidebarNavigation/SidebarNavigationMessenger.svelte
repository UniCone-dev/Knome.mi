<script lang="ts">
	import { Check, MessageCircleMore, MoreVertical, Palette, Plus, Search, Settings2, UserRound, Users } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import MessengerAvatar from '$lib/components/app/chat/ChatScreen/MessengerAvatar.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { SETTINGS_KEYS } from '$lib/constants/settings-keys.constants';
	import { ColorMode } from '$lib/enums';
	import { RouterService } from '$lib/services/router.service';
	import {
		charactersStore,
		chatStore,
		conversationsStore,
		deviceStore,
		settingsStore,
		uiStore
	} from '$lib/stores';
	import {
		formatChatTime,
		GENERAL_CONTACT_ID,
		messengerStore
	} from '$lib/stores/messenger.svelte';

	interface Props {
		onOpenSettings: () => void;
	}

	let { onOpenSettings }: Props = $props();

	interface Contact {
		id: string;
		name: string;
		url?: string;
		kind?: 'image' | 'gif' | 'video';
		chats: DatabaseConversation[];
		latest?: DatabaseConversation;
		general?: boolean;
	}

	let query = $state('');

	const characters = $derived(charactersStore.characters.filter((c) => !c.isUserPersona));

	const contacts = $derived.by<Contact[]>(() => {
		const list: Contact[] = characters.map((c) => {
			const chats = messengerStore.chatsFor(c.id);

			return { chats, id: c.id, kind: c.avatarKind, latest: chats[0], name: c.name, url: c.avatarUrl };
		});

		list.sort(
			(a, b) =>
				(b.latest?.lastModified ?? 0) - (a.latest?.lastModified ?? 0) || a.name.localeCompare(b.name)
		);

		const general = messengerStore.chatsFor(GENERAL_CONTACT_ID);

		// chats made before characters were tracked per chat stay reachable here
		if (general.length > 0) {
			list.push({
				chats: general,
				general: true,
				id: GENERAL_CONTACT_ID,
				latest: general[0],
				name: 'General chats'
			});
		}

		return list;
	});

	// load the last-message preview of each contact's latest chat
	$effect(() => {
		for (const c of contacts) if (c.latest) messengerStore.ensurePreview(c.latest);
	});

	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();

		if (!q) return contacts;

		return contacts.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.chats.some(
					(chat) =>
						chat.name.toLowerCase().includes(q) ||
						(messengerStore.preview(chat)?.text ?? '').toLowerCase().includes(q)
				)
		);
	});

	const onChatRoute = $derived(page.url.hash.startsWith('#/chat/'));

	const currentContactId = $derived<string | undefined>(
		onChatRoute && conversationsStore.activeConversation
			? (conversationsStore.activeConversation.characterId ?? GENERAL_CONTACT_ID)
			: charactersStore.activeCharacterId
	);

	const typing = $derived(chatStore.isStreaming());

	function collapseOnMobile() {
		if (deviceStore.isMobile) uiStore.isSidebarExpanded = false;
	}

	async function openContact(contact: Contact) {
		messengerStore.autoOpened = true;
		messengerStore.closeInfo();
		charactersStore.setActiveCharacter(contact.general ? undefined : contact.id);

		if (contact.latest) {
			await goto(RouterService.chat(contact.latest.id));
		} else {
			conversationsStore.clearActiveConversation();
			await goto('#/');
		}

		collapseOnMobile();
	}

	// Opening Knome on the start page in Messenger layout: continue the active character's latest chat.
	$effect(() => {
		if (messengerStore.autoOpened) return;

		const hash = page.url.hash;

		if (!(hash === '' || hash === '#' || hash === '#/')) {
			messengerStore.autoOpened = true;

			return;
		}

		const id = charactersStore.activeCharacterId;
		const latest = id ? messengerStore.chatsFor(id)[0] : undefined;

		if (latest) {
			messengerStore.autoOpened = true;
			void goto(RouterService.chat(latest.id));
		}
	});

	// the Characters dialog lives in SidebarNavigation; this asks it to open
	function openCharacters() {
		messengerStore.requestCharactersDialog();
	}

	const themeOptions = [
		{ label: 'System', value: ColorMode.SYSTEM },
		{ label: 'Light', value: ColorMode.LIGHT },
		{ label: 'Dark', value: ColorMode.DARK },
		{ label: 'Paper', value: ColorMode.PAPER },
		{ label: 'Slate', value: ColorMode.SLATE },
		{ label: 'Nova', value: ColorMode.NOVA }
	];

	const currentTheme = $derived(
		(settingsStore.config[SETTINGS_KEYS.THEME] as string | undefined) ?? ColorMode.SYSTEM
	);

	function subtitle(c: Contact): string {
		if (typing && c.id === currentContactId && onChatRoute) return 'typing…';

		const p = c.latest ? messengerStore.preview(c.latest) : undefined;

		if (p?.text) return `${p.role === 'user' ? 'You: ' : ''}${p.text}`;

		if (c.latest) return c.latest.name;

		return 'Tap to start chatting';
	}
</script>

<aside
	class={[
		'messenger-sidebar',
		'fixed md:sticky top-2 left-2 md:left-0 md:ml-2 md:mt-2 z-20',
		'w-[calc(100dvw-1rem)] md:w-80 md:h-[calc(100dvh-1.125rem)] h-[calc(100dvh-1rem)]',
		'rounded-3xl md:rounded-2xl flex-col overflow-hidden',
		uiStore.isSidebarExpanded ? 'flex' : 'hidden md:flex'
	]}
>
	<!-- title row -->
	<div class="flex items-center gap-2 px-4 pt-4 pb-2">
		<svg class="h-7 w-7 text-primary" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
			<g
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="44"
			>
				<path d="M168 104 V408" />
				<path d="M360 120 L206 256 L360 392" />
			</g>
			<circle cx="360" cy="256" r="30" fill="currentColor" />
		</svg>

		<h2 class="flex-1 text-xl font-semibold tracking-tight">Chats</h2>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				aria-label="Menu"
				class="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				<MoreVertical class="h-5 w-5" />
			</DropdownMenu.Trigger>

			<DropdownMenu.Content align="end" class="w-60">
				<DropdownMenu.Item onclick={openCharacters}>
					<Users class="mr-2 h-4 w-4" />
					Characters
				</DropdownMenu.Item>

				<DropdownMenu.Item onclick={onOpenSettings}>
					<Settings2 class="mr-2 h-4 w-4" />
					Settings
				</DropdownMenu.Item>

				<DropdownMenu.Separator />

				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>
						<Palette class="mr-2 h-4 w-4" />
						Theme
					</DropdownMenu.SubTrigger>

					<DropdownMenu.SubContent class="w-44">
						{#each themeOptions as opt (opt.value)}
							<DropdownMenu.Item
								onclick={() => settingsStore.updateConfig(SETTINGS_KEYS.THEME, opt.value)}
							>
								<span class="flex-1">{opt.label}</span>
								{#if currentTheme === opt.value}
									<Check class="h-4 w-4" />
								{/if}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>

				<DropdownMenu.Separator />

				<DropdownMenu.Item onclick={() => charactersStore.setLayoutMode('normal')}>
					<MessageCircleMore class="mr-2 h-4 w-4" />
					Switch to classic layout
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- search -->
	<div class="px-3 pb-2">
		<label class="messenger-search">
			<Search class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
			<input
				aria-label="Search chats"
				bind:value={query}
				class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				placeholder="Search characters and chats"
			/>
		</label>
	</div>

	<!-- contacts -->
	<div class="min-h-0 flex-1 overflow-y-auto px-2 pb-20">
		{#if characters.length === 0 && contacts.length === 0}
			<div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
				<div class="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
					<UserRound class="h-7 w-7" />
				</div>
				<p class="text-base font-medium">Create your first character</p>
				<p class="text-sm text-muted-foreground">
					In Messenger layout every chat belongs to a character. Add one and it shows up here.
				</p>
				<button class="messenger-cta" onclick={openCharacters} type="button">
					<Plus class="h-4 w-4" /> New character
				</button>
			</div>
		{:else if shown.length === 0}
			<p class="px-4 py-10 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>
		{:else}
			{#each shown as c, i (c.id)}
				<button
					class="messenger-row"
					class:active={currentContactId === c.id}
					onclick={() => openContact(c)}
					style="animation-delay: {Math.min(i, 12) * 28}ms"
					type="button"
				>
					{#if c.general}
						<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<MessageCircleMore class="h-6 w-6" />
						</div>
					{:else}
						<MessengerAvatar kind={c.kind} name={c.name} size={48} url={c.url} />
					{/if}

					<div class="min-w-0 flex-1">
						<div class="flex items-baseline justify-between gap-2">
							<p class="truncate text-[0.95rem] font-medium">{c.name}</p>
							<span class="flex-shrink-0 text-xs text-muted-foreground">
								{formatChatTime(c.latest?.lastModified)}
							</span>
						</div>

						<p
							class="truncate text-sm {typing && c.id === currentContactId && onChatRoute
								? 'text-primary'
								: 'text-muted-foreground'}"
						>
							{subtitle(c)}
						</p>
					</div>
				</button>
			{/each}
		{/if}
	</div>

	<!-- new character -->
	<button aria-label="New character" class="messenger-fab" onclick={openCharacters} type="button">
		<Plus class="h-6 w-6" />
	</button>
</aside>

<style>
	.messenger-sidebar {
		position: sticky;
		background: color-mix(in oklab, var(--sidebar, var(--muted)) 88%, transparent);
		border: 1px solid var(--sidebar-border, var(--border));
		box-shadow: 0 12px 40px -18px color-mix(in oklab, var(--foreground) 30%, transparent);
	}

	.messenger-search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.85rem;
		border-radius: 9999px;
		background: var(--muted);
		border: 1px solid transparent;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	/* the global form styles give inputs a border and padding: a pill needs neither */
	.messenger-search input {
		border: 0;
		box-shadow: none;
		padding: 0;
		background: transparent;
	}

	.messenger-search input:focus {
		outline: none;
		box-shadow: none;
	}

	.messenger-search:focus-within {
		border-color: color-mix(in oklab, var(--primary) 50%, transparent);
		background: var(--background);
	}

	.messenger-row {
		position: relative;
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.9rem;
		text-align: left;
		transition:
			background-color 0.18s ease,
			transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
		animation: messenger-row-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.messenger-row:hover {
		background: color-mix(in oklab, var(--accent) 70%, transparent);
		transform: translateX(2px);
	}

	.messenger-row.active {
		background: var(--accent);
	}

	.messenger-row.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 22%;
		bottom: 22%;
		width: 3px;
		border-radius: 3px;
		background: var(--primary);
	}

	.messenger-row:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--primary) 55%, transparent);
		outline-offset: -2px;
	}

	@keyframes messenger-row-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	.messenger-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1.1rem;
		border-radius: 9999px;
		background: var(--primary);
		color: var(--primary-foreground);
		font-size: 0.9rem;
		font-weight: 500;
		transition: transform 0.18s ease;
	}

	.messenger-cta:hover {
		transform: translateY(-1px) scale(1.03);
	}

	.messenger-fab {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		display: flex;
		height: 3.25rem;
		width: 3.25rem;
		align-items: center;
		justify-content: center;
		border-radius: 1rem;
		background: var(--primary);
		color: var(--primary-foreground);
		box-shadow: 0 10px 26px -8px color-mix(in oklab, var(--primary) 65%, transparent);
		transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.25);
	}

	.messenger-fab:hover {
		transform: translateY(-2px) scale(1.06) rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.messenger-row {
			animation: none;
		}
	}
</style>
