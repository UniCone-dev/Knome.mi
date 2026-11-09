<script lang="ts">
	import { browser } from '$app/environment';
	import {
		EMOJI_CATEGORIES,
		MAX_RECENT_EMOJIS,
		RECENT_EMOJIS_LOCALSTORAGE_KEY
	} from '$lib/constants';

	interface Props {
		onInsert: (text: string) => void;
	}

	let { onInsert }: Props = $props();

	function loadRecent(): string[] {
		if (!browser) return [];

		try {
			const parsed = JSON.parse(localStorage.getItem(RECENT_EMOJIS_LOCALSTORAGE_KEY) ?? '[]');

			return Array.isArray(parsed) ? parsed.filter((e) => typeof e === 'string') : [];
		} catch {
			return [];
		}
	}

	let recent = $state<string[]>(loadRecent());
	let scroller = $state<HTMLDivElement | null>(null);

	function pick(emoji: string) {
		onInsert(emoji);

		recent = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, MAX_RECENT_EMOJIS);

		try {
			localStorage.setItem(RECENT_EMOJIS_LOCALSTORAGE_KEY, JSON.stringify(recent));
		} catch {
			// storage full/blocked -- recents just won't persist
		}
	}

	function jumpTo(id: string) {
		const el = scroller?.querySelector<HTMLElement>(`[data-emoji-section="${id}"]`);

		if (el && scroller) scroller.scrollTo({ behavior: 'smooth', top: el.offsetTop - 4 });
	}
</script>

<div class="w-80">
	<!-- category jump bar -->
	<div class="flex items-center justify-between gap-0.5 border-b border-border/60 px-2 py-1.5">
		{#each EMOJI_CATEGORIES as category (category.id)}
			<button
				class="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-accent"
				onclick={() => jumpTo(category.id)}
				title={category.title}
				type="button"
			>
				{category.icon}
			</button>
		{/each}
	</div>

	<div bind:this={scroller} class="relative max-h-72 space-y-3 overflow-y-auto p-3">
		{#if recent.length > 0}
			<div class="space-y-1.5" data-emoji-section="recent">
				<p class="px-1 text-xs font-medium text-muted-foreground">Recently used</p>

				<div class="grid grid-cols-8 gap-0.5">
					{#each recent as emoji (emoji)}
						<button
							class="flex h-9 items-center justify-center rounded-md text-xl hover:bg-accent"
							onclick={() => pick(emoji)}
							type="button"
						>
							{emoji}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#each EMOJI_CATEGORIES as category (category.id)}
			<div class="space-y-1.5" data-emoji-section={category.id}>
				<p class="px-1 text-xs font-medium text-muted-foreground">{category.title}</p>

				<div class="grid grid-cols-8 gap-0.5">
					{#each category.emojis as emoji, i (emoji + i)}
						<button
							class="flex h-9 items-center justify-center rounded-md text-xl hover:bg-accent"
							onclick={() => pick(emoji)}
							type="button"
						>
							{emoji}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
