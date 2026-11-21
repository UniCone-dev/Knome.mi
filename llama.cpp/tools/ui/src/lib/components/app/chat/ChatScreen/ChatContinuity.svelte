<script lang="ts">
	import { ArrowRight, Loader2, RefreshCw, X } from '@lucide/svelte';
	import { chatStore } from '$lib/stores/chat/index.svelte';
	import { continuityStore } from '$lib/stores/continuity.svelte';
	import { conversationsStore } from '$lib/stores/conversations/index.svelte';
	import { untrack } from 'svelte';

	let conv = $derived(conversationsStore.activeConversation);
	let percent = $derived(continuityStore.percent);
	let working = $derived(continuityStore.status === 'working');
	let failed = $derived(continuityStore.status === 'error');
	let manualOffer = $derived(
		continuityStore.mode === 'manual' &&
			continuityStore.due &&
			!!conv &&
			!continuityStore.isDismissed(conv.id)
	);

	// auto mode: the moment a reply has finished and the chat is over the threshold, hand it over
	let wasLoading = false;

	$effect(() => {
		const loading = chatStore.isLoading;
		const justFinished = wasLoading && !loading;

		wasLoading = loading;

		if (justFinished) untrack(() => void continuityStore.maybeAutoRun());
	});
</script>

{#if working || failed || manualOffer}
	<div class="pointer-events-auto mx-auto mb-3 w-full max-w-[48rem] px-1">
		<div
			class="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm backdrop-blur"
			role="status"
		>
			{#if working}
				<div class="flex items-center gap-3 text-sm">
					<Loader2 class="h-4 w-4 animate-spin text-primary" />

					<div>
						<p class="font-medium">Your conversation is getting long</p>

						<p class="text-muted-foreground">
							{continuityStore.step || 'Preparing the handoff ...'} Nothing is deleted.
						</p>
					</div>
				</div>
			{:else if failed}
				<div class="flex items-start justify-between gap-3 text-sm">
					<div class="min-w-0">
						<p class="font-medium">Could not continue in a new chat</p>

						<p class="text-muted-foreground">
							{continuityStore.error} This chat is untouched, you can keep writing here.
						</p>
					</div>

					<div class="flex shrink-0 items-center gap-1">
						<button
							class="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
							onclick={() => continuityStore.run()}
						>
							<RefreshCw class="h-3 w-3" />
							Retry
						</button>

						<button
							aria-label="Close"
							class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
							onclick={() => conv && continuityStore.dismiss(conv.id)}
						>
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-medium">Your conversation is getting long</p>

							<p class="text-sm text-muted-foreground">
								Knome can keep the important parts (goals, decisions, progress, open tasks) and
								continue in a fresh context.
							</p>
						</div>

						<button
							aria-label="Not now"
							class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
							onclick={() => conv && continuityStore.dismiss(conv.id)}
						>
							<X class="h-3.5 w-3.5" />
						</button>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between text-xs text-muted-foreground">
							<span>Context usage</span>

							<span>{percent ?? '?'}%</span>
						</div>

						<div class="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								style:width="{Math.min(100, percent ?? 0)}%"
								class="h-full rounded-full bg-primary"
							></div>
						</div>
					</div>

					<button
						class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
						onclick={() => continuityStore.run()}
					>
						Continue in new context
						<ArrowRight class="h-4 w-4" />
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
