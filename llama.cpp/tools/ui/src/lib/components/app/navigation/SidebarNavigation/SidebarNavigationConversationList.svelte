<script lang="ts">
	import SidebarNavigationConversationItem from './SidebarNavigationConversationItem.svelte';
	import SidebarNavigationSearchResults from './SidebarNavigationSearchResults.svelte';
	import SidebarNavigationSelectionBar from './SidebarNavigationSelectionBar.svelte';
	import { Eye, EyeOff, Pin } from '@lucide/svelte';
	import { conversationsStore } from '$lib/stores';
	import { buildConversationTree } from '$lib/utils';

	interface Props {
		class: string;
		filteredConversations: DatabaseConversation[];
		currentChatId: string | undefined;
		isSearchModeActive: boolean;
		searchQuery: string;
		isSelectionMode?: boolean;
		selectedIds?: Set<string>;
		onSelect: (id: string) => void;
		onEdit: (id: string) => void;
		onDelete: (id: string) => void;
		onStop: (id: string) => void;
		onToggleSelect?: (id: string) => void;
		onEnterSelectionMode?: (id: string) => void;
		onSelectionClick?: (id: string, options: { shiftKey: boolean }) => void;
		onRowMouseDown?: (id: string, event: MouseEvent) => void;
		visibleCount: number;
		allVisibleSelected: boolean;
		someVisibleSelected: boolean;
		allSelectedArePinned: boolean;
		pinStateIsMixed: boolean;
		onSelectAllToggle: () => void;
		onBulkPinToggle: () => void;
		onBulkExport: () => void;
		onBulkDelete: () => void;
		onCloseSelection: () => void;
	}

	let {
		allSelectedArePinned,
		allVisibleSelected,
		class: className,
		currentChatId,
		filteredConversations,
		isSearchModeActive,
		isSelectionMode = false,
		onBulkDelete,
		onBulkExport,
		onBulkPinToggle,
		onCloseSelection,
		onDelete,
		onEdit,
		onEnterSelectionMode,
		onRowMouseDown,
		onSelect,
		onSelectAllToggle,
		onSelectionClick,
		onStop,
		onToggleSelect,
		pinStateIsMixed,
		searchQuery,
		selectedIds = new Set<string>(),
		someVisibleSelected,
		visibleCount
	}: Props = $props();

	let conversationTree = $derived(buildConversationTree(filteredConversations));

	let pinnedConversations = $derived(
		conversationTree.filter(({ conversation }) => conversation.pinned)
	);

	let unpinnedConversations = $derived(
		conversationTree.filter(({ conversation }) => !conversation.pinned)
	);

	/** Date bucket for the section headings: Today / Yesterday / Previous 7 days / Previous 30 days / Older. */
	function bucketOf(ts: number): string {
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const day = 86_400_000;

		if (ts >= startOfToday) return 'Today';
		if (ts >= startOfToday - day) return 'Yesterday';
		if (ts >= startOfToday - 7 * day) return 'Previous 7 days';
		if (ts >= startOfToday - 30 * day) return 'Previous 30 days';

		return 'Older';
	}

	const recentEmptyMessage = $derived(
		searchQuery.length > 0 ? 'No results found' : 'No conversations yet'
	);
</script>

<div class="flex min-h-0 flex-1 flex-col">
	{#if isSearchModeActive}
		<SidebarNavigationSearchResults
			class={className}
			{currentChatId}
			{filteredConversations}
			{isSelectionMode}
			{onDelete}
			{onEdit}
			{onEnterSelectionMode}
			{onRowMouseDown}
			{onSelect}
			{onSelectionClick}
			{onStop}
			{onToggleSelect}
			{searchQuery}
			{selectedIds}
		/>
	{:else}
		{#if pinnedConversations.length > 0}
			<div class="py-2 flex whitespace-nowrap {className}">
				<div
					class="text-muted-foreground inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium gap-1"
				>
					<Pin class="h-3.5 w-3.5" />

					<span>Pinned</span>
				</div>
			</div>

			<ul class="flex w-full min-w-0 flex-col gap-4 md:gap-1 {className}">
				{#each pinnedConversations as { conversation, depth } (conversation.id)}
					<li class="group/item relative mb-1 p-0">
						<SidebarNavigationConversationItem
							conversation={{
								currNode: conversation.currNode,
								forkedFromConversationId: conversation.forkedFromConversationId,
								id: conversation.id,
								lastModified: conversation.lastModified,
								name: conversation.name,
								hidden: conversation.hidden,
								pinned: conversation.pinned
							}}
							{depth}
							isActive={currentChatId === conversation.id}
							isSelected={selectedIds.has(conversation.id)}
							{isSelectionMode}
							{onDelete}
							{onEdit}
							{onEnterSelectionMode}
							{onRowMouseDown}
							{onSelect}
							{onSelectionClick}
							{onStop}
							{onToggleSelect}
						/>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-2 flex min-h-0 flex-1 flex-col gap-4 md:gap-0 whitespace-nowrap {className}">
			{#if filteredConversations.length > 0}
				<div
					class="text-muted-foreground flex h-6 shrink-0 items-center rounded-md px-2 text-[0.7rem] font-semibold tracking-wider uppercase"
				>
					Chats
				</div>
			{/if}

			<div class="min-h-0 flex-1 md:overflow-y-auto">
				<ul class="flex w-full min-w-0 flex-col gap-4 md:gap-0">
					{#each unpinnedConversations as { conversation, depth }, i (conversation.id)}
						{#if depth === 0 && (i === 0 || bucketOf(conversation.lastModified) !== bucketOf(unpinnedConversations.slice(0, i).findLast((c) => c.depth === 0)?.conversation.lastModified ?? 0))}
							<li
								class="sidebar-group-label px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground"
							>
								{bucketOf(conversation.lastModified)}
							</li>
						{/if}

						<li class="group/item relative mb-1 p-0">
							<SidebarNavigationConversationItem
								conversation={{
									currNode: conversation.currNode,
									forkedFromConversationId: conversation.forkedFromConversationId,
									id: conversation.id,
									lastModified: conversation.lastModified,
									name: conversation.name,
									hidden: conversation.hidden,
									pinned: conversation.pinned
								}}
								{depth}
								isActive={currentChatId === conversation.id}
								isSelected={selectedIds.has(conversation.id)}
								{isSelectionMode}
								{onDelete}
								{onEdit}
								{onEnterSelectionMode}
								{onRowMouseDown}
								{onSelect}
								{onSelectionClick}
								{onStop}
								{onToggleSelect}
							/>
						</li>
					{/each}

					{#if conversationsStore.hiddenCount > 0 && !isSearchModeActive}
						<li class="mt-2 px-1">
							<button
								class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
								onclick={() => (conversationsStore.showHidden = !conversationsStore.showHidden)}
								type="button"
							>
								{#if conversationsStore.showHidden}
									<EyeOff class="h-3.5 w-3.5" />
									Hide hidden chats again
								{:else}
									<Eye class="h-3.5 w-3.5" />
									Show hidden chats ({conversationsStore.hiddenCount})
								{/if}
							</button>
						</li>
					{/if}

					{#if unpinnedConversations.length === 0}
						<li class="px-2 py-4 text-center">
							<p class="mb-4 p-4 text-sm text-muted-foreground">
								{recentEmptyMessage}
							</p>
						</li>
					{/if}
				</ul>
			</div>
		</div>

		{#if isSelectionMode}
			<SidebarNavigationSelectionBar
				{allVisibleSelected}
				class="sticky top-0 z-10 m-2 mt-0"
				{onBulkDelete}
				{onBulkExport}
				{onBulkPinToggle}
				onClose={onCloseSelection}
				{onSelectAllToggle}
				{pinStateIsMixed}
				selectedCount={selectedIds.size}
				someSelectedPinned={allSelectedArePinned}
				{someVisibleSelected}
				{visibleCount}
			/>
		{/if}
	{/if}
</div>
