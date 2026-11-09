<script lang="ts">
	import { PanelLeftClose, PanelLeftOpen, Settings, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ActionIcon,
		DialogCharacters,
		DialogConversationRename,
		DialogLibrary,
		DialogModels,
		DialogSettingsChat,
		Logo,
		SidebarNavigationActions,
		SidebarNavigationConversationList,
		SidebarNavigationProjectsList
	} from '$lib/components/app';
	import SidebarNavigationMessenger from './SidebarNavigationMessenger.svelte';
	import { APP_NAME, ROUTES, SETTINGS_KEYS } from '$lib/constants';
	import { TooltipSide } from '$lib/enums';
	import { useKeyboardShortcuts } from '$lib/hooks/use-keyboard-shortcuts.svelte';
	import { useMarqueeSelection } from '$lib/hooks/use-marquee-selection.svelte';
	import { RouterService } from '$lib/services/router.service';
	import {
		charactersStore,
		chatStore,
		conversationsStore,
		deviceStore,
		messengerStore,
		settingsStore,
		uiStore
	} from '$lib/stores';
	import { buildConversationTree } from '$lib/utils';
	import { circIn } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';

	interface Props {
		onSearchClick?: () => void;
	}

	let { onSearchClick = () => {} }: Props = $props();

	const { handleKeydown } = useKeyboardShortcuts({
		activateSearchMode: () => onSearchClick(),
		toggleSidebar: () => toggleExpandedMode()
	});

	let hoveredTooltip = $state<string | null>(null);
	let logoHovered = $state(false);

	const isStripExpanded = $derived(uiStore.isSidebarExpanded || hoveredTooltip !== null);
	const isOnMobile = $derived(deviceStore.isMobile);
	const profileName = $derived(
		((settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] as string) || '').trim()
	);
	const profileAvatar = $derived((settingsStore.config[SETTINGS_KEYS.PROFILE_AVATAR] as string) || '');
	const alwaysShowOnDesktop = $derived(settingsStore.config.alwaysShowSidebarOnDesktop as boolean);

	// open once at start (not on every change), so the collapse button keeps working
	let openedAtStart = false;

	$effect(() => {
		if (alwaysShowOnDesktop && !isOnMobile && !openedAtStart) {
			openedAtStart = true;
			uiStore.isSidebarExpanded = true;
		}
	});

	function toggleExpandedMode() {
		uiStore.isSidebarExpanded = !uiStore.isSidebarExpanded;

		if (!uiStore.isSidebarExpanded) {
			hoveredTooltip = null;
		}
	}

	$effect(() => {
		if (!uiStore.isSidebarExpanded) {
			isSearchModeActive = false;
			searchQuery = '';

			if (isSelectionMode) exitSelectionMode();

			cancelMobileCollapse();
		}
	});

	$effect(() => {
		if (deviceStore.isMobile && page.url.hash.includes(ROUTES.SEARCH)) {
			uiStore.isSidebarExpanded = false;
		}
	});

	let currentChatId = $derived(page.params.id);
	let isSearchModeActive = $state(false);
	let searchQuery = $state('');

	let filteredConversations = $derived.by(() => {
		if (isSearchModeActive) {
			if (searchQuery.trim().length > 0) {
				return conversationsStore.conversations.filter(
					(conversation) =>
						(!conversation.hidden || conversationsStore.showHidden) &&
						conversation.name.toLowerCase().includes(searchQuery.toLowerCase())
				);
			}

			return [];
		}

		return conversationsStore.conversations.filter(
			(conversation) => !conversation.hidden || conversationsStore.showHidden
		);
	});

	let isSelectionMode = $state(false);
	let selectedIds = new SvelteSet<string>();

	let renameDialogOpen = $state(false);
	let settingsDialogOpen = $state(false);
	let charactersDialogOpen = $state(false);

	// the Messenger sidebar (a separate component) asks for the Characters dialog through the store
	$effect(() => {
		if (messengerStore.charactersDialogRequested) {
			messengerStore.charactersDialogRequested = false;
			charactersDialogOpen = true;
		}
	});
	let renameTargetConversationId = $state<string | null>(null);
	let renameDraft = $state('');
	let renameOriginalTitle = $state('');

	const renderedOrderIds = $derived(
		buildConversationTree(filteredConversations).map((t) => t.conversation.id)
	);

	const allSelectedArePinned = $derived.by(() => {
		if (selectedIds.size === 0) return false;

		const convs = conversationsStore.conversations;

		for (const id of selectedIds) {
			const c = convs.find((conv) => conv.id === id);

			if (c && !c.pinned) return false;
		}

		return true;
	});

	const pinStateIsMixed = $derived.by(() => {
		if (selectedIds.size === 0) return false;

		const convs = conversationsStore.conversations;

		let anyPinned = false;
		let anyUnpinned = false;

		for (const id of selectedIds) {
			const c = convs.find((conv) => conv.id === id);

			if (!c) continue;

			if (c.pinned) anyPinned = true;
			else anyUnpinned = true;

			if (anyPinned && anyUnpinned) return true;
		}

		return false;
	});

	const visibleSelectionStats = $derived.by(() => {
		const visibleIds = filteredConversations.map((c) => c.id);

		let selectedVisible = 0;

		for (const id of visibleIds) {
			if (selectedIds.has(id)) selectedVisible++;
		}

		return {
			selectedVisibleCount: selectedVisible,
			visibleCount: visibleIds.length
		};
	});

	function enterSelectionMode(id?: string) {
		isSelectionMode = true;

		if (id !== undefined) {
			selectedIds.add(id);
		}
	}

	function exitSelectionMode() {
		isSelectionMode = false;
		selectedIds.clear();
	}

	function toggleSelected(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
	}

	function toggleSelectAllVisible() {
		const visibleIds = filteredConversations.map((c) => c.id);
		const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

		if (allSelected) {
			for (const id of visibleIds) selectedIds.delete(id);
		} else {
			for (const id of visibleIds) selectedIds.add(id);
		}
	}

	async function handleBulkDelete() {
		const ids = Array.from(selectedIds);

		if (ids.length === 0) return;

		await conversationsStore.bulkDeleteConversations(ids);
		exitSelectionMode();
	}

	async function handleBulkPinToggle() {
		const ids = Array.from(selectedIds);

		if (ids.length === 0) return;

		await conversationsStore.bulkToggleConversationPin(ids);
	}

	async function handleBulkExport() {
		const ids = Array.from(selectedIds);

		if (ids.length === 0) return;

		await conversationsStore.bulkExportConversations(ids);
	}

	const marquee = useMarqueeSelection({
		enabled: () => isSelectionMode,
		orderedIds: () => renderedOrderIds,
		selectedIds: () => selectedIds
	});

	function handleRowMouseDown(id: string, event: MouseEvent) {
		if (!isSelectionMode) return;

		marquee.rowMouseDown(id, event);
	}

	function handleSelectionClick(id: string, options: { shiftKey: boolean }): void {
		if (!isSelectionMode) return;

		marquee.rowClick(id, options.shiftKey);
	}

	async function selectConversation(id: string) {
		if (deviceStore.isMobile) {
			scheduleMobileCollapse();
		}

		await goto(RouterService.chat(id));
	}

	async function handleEditConversation(id: string) {
		const conversation = conversationsStore.conversations.find((conv) => conv.id === id);

		if (!conversation) return;

		renameTargetConversationId = id;
		renameOriginalTitle = conversation.name;
		renameDraft = conversation.name;
		renameDialogOpen = true;
	}

	async function handleRenameConfirm() {
		const id = renameTargetConversationId;

		if (!id) return;

		const nextName = renameDraft.trim();

		if (!nextName || nextName === renameOriginalTitle.trim()) return;

		await conversationsStore.updateConversationName(id, nextName);

		renameDialogOpen = false;
		renameTargetConversationId = null;
	}

	function handleRenameCancel() {
		renameDialogOpen = false;
		renameTargetConversationId = null;
		renameDraft = '';
		renameOriginalTitle = '';
	}

	async function handleDeleteConversation(id: string) {
		const conversation = conversationsStore.conversations.find((conv) => conv.id === id);

		if (!conversation) return;

		const confirmed = window.confirm(
			`Delete "${conversation.name}"? This action cannot be undone.`
		);

		if (!confirmed) return;

		await conversationsStore.deleteConversation(id, { deleteWithForks: false });
	}

	function handleStopGeneration(id: string) {
		chatStore.stopGenerationForChat(id);
	}

	let innerWidth = $state(0);
	let pendingCollapse = $state<ReturnType<typeof setTimeout> | null>(null);

	function scheduleMobileCollapse() {
		if (pendingCollapse) {
			clearTimeout(pendingCollapse);
		}

		pendingCollapse = setTimeout(() => {
			uiStore.isSidebarExpanded = false;
			pendingCollapse = null;
		}, 100);
	}

	function cancelMobileCollapse() {
		if (pendingCollapse) {
			clearTimeout(pendingCollapse);
			pendingCollapse = null;
		}
	}
</script>

<svelte:window bind:innerWidth onkeydown={handleKeydown} />

{#if charactersStore.isWhatsappMode}
	<SidebarNavigationMessenger onOpenSettings={() => (settingsDialogOpen = true)} />
{:else if innerWidth > 768 || !page.url.hash.includes(ROUTES.SEARCH)}
	<aside
		class={[
			'fixed md:sticky top-2 left-2 md:left-0 md:top-0 md:ml-0 md:mt-0 pt-2 z-10 w-[calc(100dvw-1rem)]',
			'md:h-dvh',
			uiStore.isSidebarExpanded &&
				(deviceStore.isStandalone
					? 'h-[calc(100dvh-2rem)]'
					: deviceStore.isIOSDevice
						? 'h-[calc(100dvh-0.5rem)]'
						: 'h-[calc(100dvh-1rem)]'),
			'rounded-3xl md:rounded-none',
			'flex flex-col justify-between',
			'md:transition-[width,padding] duration-200 ease-out',
			isStripExpanded && 'md:w-72 md:bg-sidebar md:border-r md:border-sidebar-border md:backdrop-blur-xl',
			!isStripExpanded && 'md:w-14',
			uiStore.isSidebarExpanded && 'is-expanded'
		]}
	>
		<div class="px-2 flex items-center justify-between">
			<div
				class="relative"
				onmouseenter={() => (logoHovered = true)}
				onmouseleave={() => (logoHovered = false)}
				role="button"
				tabindex="0"
			>
				<ActionIcon
					ariaLabel={uiStore.isSidebarExpanded ? 'Go to start' : 'Expand navigation'}
					class="{uiStore.isSidebarExpanded
						? 'bg-muted! md:bg-foreground/5!'
						: 'bg-transparent!'} md:h-9 md:w-9 h-10 w-10 rounded-full md:hover:bg-foreground/10! pointer-events-auto"
					href={uiStore.isSidebarExpanded ? ROUTES.START : undefined}
					icon={!uiStore.isSidebarExpanded && logoHovered && innerWidth > 768
						? PanelLeftOpen
						: Logo}
					iconSize="h-4.5 w-4.5 md:h-4 md:w-4"
					onclick={uiStore.isSidebarExpanded ? undefined : toggleExpandedMode}
					size="lg"
					tooltip={uiStore.isSidebarExpanded ? undefined : 'Open Sidebar'}
					tooltipSide={TooltipSide.RIGHT}
				/>
			</div>

			{#if isOnMobile || uiStore.isSidebarExpanded}
				<div
					in:fade={{ delay: 50, duration: 150, easing: circIn }}
					out:fade={{ duration: 100 }}
					class="flex items-center transition-all duration-150 ease-out {deviceStore.isMobile &&
					!uiStore.isSidebarExpanded
						? 'opacity-0 h-0!'
						: ''}"
				>
					<ActionIcon
						ariaLabel="Collapse navigation"
						class="backdrop-blur-none md:h-9 md:w-9 h-10 w-10 rounded-full mr-1 hover:bg-accent!"
						icon={deviceStore.isMobile ? X : PanelLeftClose}
						iconSize="h-4.5 w-4.5 md:h-4 md:w-4"
						onclick={toggleExpandedMode}
						size="lg"
						tooltip="Close Sidebar"
						tooltipSide={TooltipSide.LEFT}
					/>
				</div>
			{/if}
		</div>

		<div
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 200 }}
			class="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:gap-1 {deviceStore.isMobile
				? 'transition-[opacity,height] duration-200 ease-out'
				: ''} {deviceStore.isMobile && !uiStore.isSidebarExpanded ? 'opacity-0 !h-0' : ''}"
		>
			<SidebarNavigationActions
				bind:isSearchModeActive
				bind:searchQuery
				class="px-2"
				isExpandedMode={innerWidth > 768 ? uiStore.isSidebarExpanded : true}
				onNewChat={() => {
					if (deviceStore.isMobile) {
						scheduleMobileCollapse();
					}
				}}
				onSearchClick={() => {
					uiStore.isSidebarExpanded = true;
					isSearchModeActive = true;
				}}
				onSearchDeactivated={() => {
					isSearchModeActive = false;
					searchQuery = '';
				}}
				onSettingsClick={() => (settingsDialogOpen = true)}
				onCharactersClick={() => (charactersDialogOpen = true)}
			/>

			{#if uiStore.isSidebarExpanded || isOnMobile}
				<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
					{#if !isSearchModeActive}
						<SidebarNavigationProjectsList />
					{/if}

					<SidebarNavigationConversationList
						{allSelectedArePinned}
						allVisibleSelected={visibleSelectionStats.visibleCount > 0 &&
							visibleSelectionStats.selectedVisibleCount === visibleSelectionStats.visibleCount}
						class="px-2"
						{currentChatId}
						{filteredConversations}
						{isSearchModeActive}
						{isSelectionMode}
						onBulkDelete={handleBulkDelete}
						onBulkExport={handleBulkExport}
						onBulkPinToggle={handleBulkPinToggle}
						onCloseSelection={exitSelectionMode}
						onDelete={handleDeleteConversation}
						onEdit={handleEditConversation}
						onEnterSelectionMode={enterSelectionMode}
						onRowMouseDown={handleRowMouseDown}
						onSelect={selectConversation}
						onSelectAllToggle={toggleSelectAllVisible}
						onSelectionClick={handleSelectionClick}
						onStop={handleStopGeneration}
						onToggleSelect={toggleSelected}
						{pinStateIsMixed}
						{searchQuery}
						{selectedIds}
						someVisibleSelected={visibleSelectionStats.selectedVisibleCount > 0 &&
							visibleSelectionStats.selectedVisibleCount < visibleSelectionStats.visibleCount}
						visibleCount={visibleSelectionStats.visibleCount}
					/>
				</div>
			{/if}
		</div>

		{#if uiStore.isSidebarExpanded && innerWidth > 768}
			<button
				class="sidebar-profile mx-2 mb-2 flex items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-foreground/5"
				onclick={() => (settingsDialogOpen = true)}
				type="button"
			>
				<span
					class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary"
				>
					{#if profileAvatar}
						<img alt="" class="h-full w-full object-cover" src={profileAvatar} />
					{:else}
						{(profileName || APP_NAME).charAt(0).toUpperCase()}
					{/if}
				</span>

				<span class="min-w-0 flex-1">
					<span class="block truncate text-sm font-medium">{profileName || 'Set up your profile'}</span>
					<span class="block truncate text-xs text-muted-foreground">Settings</span>
				</span>

				<Settings class="h-4 w-4 shrink-0 text-muted-foreground" />
			</button>
		{/if}
	</aside>
{/if}

<DialogConversationRename
	bind:open={renameDialogOpen}
	bind:value={renameDraft}
	currentTitle={renameOriginalTitle}
	onCancel={handleRenameCancel}
	onConfirm={handleRenameConfirm}
/>

<DialogSettingsChat bind:open={settingsDialogOpen} />

<DialogCharacters bind:open={charactersDialogOpen} />

<DialogLibrary />
<DialogModels />

<style>
	aside {
		@media (max-width: 768px) {
			--size: 1.125rem;
		}
	}

	@media (max-width: 768px) {
		aside {
			&:not(.is-expanded) {
				pointer-events: none;
			}
		}

		aside.is-expanded::before {
			content: '';
			position: fixed;
			top: -0.5rem;
			bottom: -0.25rem;
			left: -0.5rem;
			right: -0.5rem;
			z-index: -1;
			background: var(--background);
			backdrop-filter: blur(1rem);
			pointer-events: none;
		}
	}
</style>
