<script lang="ts" module>
	export function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}
</script>

<script lang="ts">
	import {
		ChevronDown,
		ChevronUp,
		Download,
		EyeOff,
		MoreVertical,
		Search,
		Star,
		X
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { conversationsStore } from '$lib/stores';
	import { jumpToMessage, messageMetaStore } from '$lib/stores/message-meta.svelte';

	let findOpen = $state(false);
	let query = $state('');
	let index = $state(0);
	let starredOpen = $state(false);

	const messages = $derived(
		(conversationsStore.activeMessages as DatabaseMessage[]).filter(
			(m) => (m.role === 'user' || m.role === 'assistant') && m.content
		)
	);
	const hits = $derived(
		query.trim()
			? messages.filter((m) => m.content.toLowerCase().includes(query.trim().toLowerCase()))
			: []
	);
	const starred = $derived(messages.filter((m) => messageMetaStore.isStarred(m.id)));

	function go(delta: number) {
		if (!hits.length) return;

		index = (index + delta + hits.length) % hits.length;
		jumpToMessage(hits[index].id);
	}

	function onQuery() {
		index = 0;

		if (hits.length) jumpToMessage(hits[0].id);
	}

	function snippet(text: string): string {
		const t = text.replace(/\s+/g, ' ').trim();

		return t.length > 140 ? `${t.slice(0, 140)}...` : t;
	}

	async function hideChat() {
		const id = conversationsStore.activeConversation?.id;

		if (id) await conversationsStore.toggleConversationHidden(id);
	}

	async function exportChat() {
		const id = conversationsStore.activeConversation?.id;

		if (id) await conversationsStore.downloadConversation(id);
	}
</script>

<button
	aria-label="Search in chat"
	class="chat-character-tool"
	onclick={() => (findOpen = !findOpen)}
	type="button"
>
	<Search class="h-4 w-4" />
</button>

<DropdownMenu.Root>
	<DropdownMenu.Trigger aria-label="More" class="chat-character-tool">
		<MoreVertical class="h-4 w-4" />
	</DropdownMenu.Trigger>

	<DropdownMenu.Content align="end" class="w-52 rounded-xl">
		<DropdownMenu.Item class="gap-2" onclick={() => (findOpen = true)}>
			<Search class="h-4 w-4" /> Search in chat
		</DropdownMenu.Item>
		<DropdownMenu.Item class="gap-2" onclick={() => (starredOpen = true)}>
			<Star class="h-4 w-4" /> Starred messages
		</DropdownMenu.Item>
		<DropdownMenu.Item class="gap-2" onclick={exportChat}>
			<Download class="h-4 w-4" /> Export chat
		</DropdownMenu.Item>
		<DropdownMenu.Item class="gap-2" onclick={hideChat}>
			<EyeOff class="h-4 w-4" /> Hide chat
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

{#if findOpen}
	<div
		class="fixed top-20 left-1/2 z-40 flex w-[min(28rem,92vw)] -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-border bg-popover p-2 shadow-lg"
	>
		<Search class="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
		<input
			bind:value={query}
			class="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
			oninput={onQuery}
			onkeydown={(e) => {
				if (e.key === 'Enter') go(e.shiftKey ? -1 : 1);
				if (e.key === 'Escape') findOpen = false;
			}}
			placeholder="Search in this chat"
			use:focusOnMount
		/>
		<span class="shrink-0 text-xs text-muted-foreground">
			{hits.length ? `${index + 1}/${hits.length}` : query ? '0' : ''}
		</span>
		<button aria-label="Previous" class="p-1" onclick={() => go(-1)} type="button">
			<ChevronUp class="h-4 w-4" />
		</button>
		<button aria-label="Next" class="p-1" onclick={() => go(1)} type="button">
			<ChevronDown class="h-4 w-4" />
		</button>
		<button aria-label="Close search" class="p-1" onclick={() => (findOpen = false)} type="button">
			<X class="h-4 w-4" />
		</button>
	</div>
{/if}

<Dialog.Root bind:open={starredOpen}>
	<Dialog.Content
		class="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto sm:max-w-lg md:rounded-2xl"
	>
		<Dialog.Title class="flex items-center gap-2 text-lg font-semibold">
			<Star class="h-5 w-5 fill-amber-400 text-amber-400" /> Starred messages
		</Dialog.Title>

		{#if starred.length === 0}
			<p class="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
				Nothing starred in this chat. Hover a message and tap the star.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each starred as m (m.id)}
					<li>
						<Button
							class="h-auto w-full justify-start rounded-xl p-3 text-left whitespace-normal"
							onclick={() => {
								starredOpen = false;
								setTimeout(() => jumpToMessage(m.id), 200);
							}}
							variant="outline"
						>
							<span class="block text-xs text-muted-foreground">
								{m.role === 'user' ? 'You' : 'AI'}
							</span>
							<span class="block text-sm">{snippet(m.content)}</span>
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</Dialog.Content>
</Dialog.Root>
