<script lang="ts">
	import { File as FileIcon, FileText, Film, Images, Music, Search, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { AttachmentType } from '$lib/enums';
	import { DatabaseService } from '$lib/services/database.service';
	import { RouterService } from '$lib/services/router.service';
	import { conversationsStore, uiStore } from '$lib/stores';
	import { tick } from 'svelte';

	type Row = Awaited<ReturnType<typeof DatabaseService.getAllAttachments>>[number];
	type Filter = 'all' | 'images' | 'documents' | 'media';

	const FILTERS: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'images', label: 'Photos' },
		{ id: 'documents', label: 'Documents' },
		{ id: 'media', label: 'Audio & video' }
	];

	let rows = $state<Row[]>([]);
	let loading = $state(false);
	let filter = $state<Filter>('all');
	let query = $state('');
	let visibleCount = $state(60);

	function kindOf(row: Row): Filter {
		switch (row.extra.type) {
			case AttachmentType.IMAGE:
				return 'images';
			case AttachmentType.AUDIO:
			case AttachmentType.VIDEO:
				return 'media';
			default:
				return 'documents';
		}
	}

	const convName = (id: string) =>
		conversationsStore.conversations.find((c) => c.id === id)?.name ?? 'Deleted chat';

	const filtered = $derived(
		rows.filter((r) => {
			if (filter !== 'all' && kindOf(r) !== filter) return false;

			const q = query.trim().toLowerCase();

			if (!q) return true;

			return (
				(r.extra.name ?? '').toLowerCase().includes(q) ||
				convName(r.convId).toLowerCase().includes(q)
			);
		})
	);

	const shown = $derived(filtered.slice(0, visibleCount));

	const counts = $derived({
		all: rows.length,
		images: rows.filter((r) => kindOf(r) === 'images').length,
		documents: rows.filter((r) => kindOf(r) === 'documents').length,
		media: rows.filter((r) => kindOf(r) === 'media').length
	});

	async function refresh() {
		loading = true;

		try {
			rows = await DatabaseService.getAllAttachments();
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (uiStore.isLibraryOpen) {
			visibleCount = 60;
			void refresh();
		}
	});

	function fmtDate(ts: number): string {
		return new Date(ts).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function fmtSize(n?: number): string {
		if (!n) return '';

		return n > 1_048_576
			? `${(n / 1_048_576).toFixed(1)} MB`
			: `${Math.max(1, Math.round(n / 1024))} KB`;
	}

	/** Open the chat the file was sent in and scroll to that message. */
	async function jump(row: Row) {
		uiStore.isLibraryOpen = false;
		await goto(RouterService.chat(row.convId));

		// wait for the messages to render, then scroll to and flash the message
		for (let i = 0; i < 40; i++) {
			await tick();

			const el = document.querySelector<HTMLElement>(`[data-message-id="${row.messageId}"]`);

			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				el.classList.add('library-flash');
				setTimeout(() => el.classList.remove('library-flash'), 2200);

				return;
			}

			await new Promise((r) => setTimeout(r, 100));
		}
	}

	function iconFor(row: Row) {
		switch (row.extra.type) {
			case AttachmentType.AUDIO:
				return Music;
			case AttachmentType.VIDEO:
				return Film;
			case AttachmentType.PDF:
			case AttachmentType.TEXT:
			case AttachmentType.LEGACY_CONTEXT:
				return FileText;
			default:
				return FileIcon;
		}
	}
</script>

<Dialog.Root bind:open={uiStore.isLibraryOpen}>
	<Dialog.Content
		class="library-dialog flex flex-col gap-0 overflow-hidden p-0 max-md:h-dvh max-md:w-full md:h-[calc(100vh-4rem)]! md:max-h-200! md:w-[calc(100vw-4rem)]! md:max-w-5xl! md:rounded-2xl"
	>
		<Dialog.Title class="sr-only">Library</Dialog.Title>

		<header class="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/60 px-5 py-4">
			<div class="flex items-center gap-2 text-lg font-semibold tracking-tight">
				<Images class="h-5 w-5 text-primary" />
				Library
				<span class="text-sm font-normal text-muted-foreground">{counts.all}</span>
			</div>

			<div class="relative ml-auto w-full max-w-xs md:mr-10">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input bind:value={query} class="h-9 rounded-xl pl-9" placeholder="Search files or chats" />
			</div>
		</header>

		<div class="flex shrink-0 gap-1.5 overflow-x-auto px-5 py-3">
			{#each FILTERS as f (f.id)}
				<button
					class="shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors {filter === f.id
						? 'border-primary bg-primary/10 text-foreground'
						: 'border-border text-muted-foreground hover:bg-muted/60'}"
					onclick={() => {
						filter = f.id;
						visibleCount = 60;
					}}
					type="button"
				>
					{f.label}
					<span class="ml-1 text-xs opacity-70">{counts[f.id]}</span>
				</button>
			{/each}
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
			{#if loading && rows.length === 0}
				<p class="py-16 text-center text-sm text-muted-foreground">Loading...</p>
			{:else if filtered.length === 0}
				<div class="flex flex-col items-center gap-2 py-20 text-center">
					<Images class="h-10 w-10 text-muted-foreground/50" />
					<p class="font-medium">
						{rows.length === 0 ? 'Nothing here yet' : 'No files match'}
					</p>
					<p class="max-w-xs text-sm text-muted-foreground">
						{rows.length === 0
							? 'Photos and files you attach to a chat will show up here, from every conversation.'
							: 'Try another filter or search.'}
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{#each shown as row, i (row.messageId + ':' + i)}
						{@const Icon = iconFor(row)}
						<button
							class="library-card group flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
							onclick={() => jump(row)}
							title="Open in chat"
							type="button"
						>
							<div class="relative aspect-square w-full overflow-hidden bg-muted/50">
								{#if row.extra.type === AttachmentType.IMAGE}
									<img
										alt={row.extra.name}
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
										loading="lazy"
										src={row.extra.base64Url}
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<Icon class="h-10 w-10 text-muted-foreground" />
									</div>
								{/if}
							</div>

							<div class="space-y-0.5 p-2.5">
								<p class="truncate text-sm font-medium">{row.extra.name || 'Untitled'}</p>
								<p class="truncate text-xs text-muted-foreground">{convName(row.convId)}</p>
								<p class="text-xs text-muted-foreground/80">
									{fmtDate(row.timestamp)}{fmtSize(row.extra.size)
										? ' · ' + fmtSize(row.extra.size)
										: ''}
								</p>
							</div>
						</button>
					{/each}
				</div>

				{#if filtered.length > shown.length}
					<div class="flex justify-center pt-5">
						<button
							class="rounded-full border px-4 py-1.5 text-sm hover:bg-muted/60"
							onclick={() => (visibleCount += 60)}
							type="button"
						>
							Show more ({filtered.length - shown.length})
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.library-flash) {
		animation: library-flash 2.2s ease;
	}

	@keyframes library-flash {
		0%,
		60% {
			background: color-mix(in oklab, var(--primary) 18%, transparent);
			box-shadow: 0 0 0 6px color-mix(in oklab, var(--primary) 18%, transparent);
			border-radius: 1rem;
		}
		100% {
			background: transparent;
			box-shadow: 0 0 0 0 transparent;
		}
	}
</style>
