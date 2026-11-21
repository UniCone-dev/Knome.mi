<script lang="ts">
	import { ChevronDown, ChevronUp, History } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { RouterService } from '$lib/services/router.service';
	import { conversationsStore } from '$lib/stores/conversations/index.svelte';

	let handoff = $derived(conversationsStore.activeConversation?.handoff);
	let open = $state(false);
</script>

{#if handoff}
	<div class="pointer-events-auto mx-auto mb-3 w-full max-w-[48rem] px-3 pt-3">
		<div class="rounded-2xl border border-border/60 bg-card/60 p-3 text-sm">
			<div class="flex items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<History class="h-4 w-4 shrink-0 text-primary" />

					<p class="min-w-0 truncate">
						Continued from
						<button
							class="font-medium underline-offset-2 hover:underline"
							onclick={() => goto(RouterService.chat(handoff.fromId))}
						>
							{handoff.fromName}
						</button>
					</p>
				</div>

				<button
					class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
					onclick={() => (open = !open)}
				>
					{open ? 'Hide' : 'What I remember'}

					{#if open}
						<ChevronUp class="h-3 w-3" />
					{:else}
						<ChevronDown class="h-3 w-3" />
					{/if}
				</button>
			</div>

			{#if open}
				<pre
					class="mt-3 max-h-64 overflow-auto rounded-xl bg-muted/50 p-3 font-sans text-xs whitespace-pre-wrap">{handoff.summary}</pre>
			{/if}
		</div>
	</div>
{/if}
