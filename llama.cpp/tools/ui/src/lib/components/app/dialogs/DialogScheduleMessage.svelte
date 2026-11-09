<script lang="ts">
	import { CalendarClock, Check, Send, Trash2 } from '@lucide/svelte';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Textarea } from '$lib/components/ui/textarea';
	import { conversationsStore } from '$lib/stores';
	import { scheduledStore, type ScheduledMessage } from '$lib/stores/scheduled.svelte';

	let text = $state('');
	let whenLocal = $state('');
	let target = $state<'here' | 'new'>('here');
	let now = $state(Date.now());

	const activeConvId = $derived(
		page.params.id && conversationsStore.activeConversation?.id
			? conversationsStore.activeConversation.id
			: undefined
	);

	// keep "in 5 min" style labels fresh while the dialog is open
	$effect(() => {
		if (!scheduledStore.dialogOpen) return;

		untrack(() => {
			now = Date.now();
			text = scheduledStore.draft;
			target = activeConvId ? 'here' : 'new';
			whenLocal = toLocalInput(Date.now() + 10 * 60_000);
		});

		const t = setInterval(() => (now = Date.now()), 15_000);

		return () => clearInterval(t);
	});

	function toLocalInput(ts: number): string {
		const d = new Date(ts);
		const pad = (n: number) => String(n).padStart(2, '0');

		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function atHour(hour: number, addDays: number): number {
		const d = new Date();

		d.setDate(d.getDate() + addDays);
		d.setHours(hour, 0, 0, 0);

		return d.getTime();
	}

	const presets = $derived([
		{ label: 'In 10 minutes', ts: Date.now() + 10 * 60_000 },
		{ label: 'In 1 hour', ts: Date.now() + 60 * 60_000 },
		{
			label: 'Tonight 9 PM',
			ts: atHour(21, new Date().getHours() >= 21 ? 1 : 0)
		},
		{ label: 'Tomorrow 9 AM', ts: atHour(9, 1) }
	]);

	const whenTs = $derived(whenLocal ? new Date(whenLocal).getTime() : NaN);
	const valid = $derived(text.trim().length > 0 && Number.isFinite(whenTs) && whenTs > now - 1000);

	function schedule() {
		if (!valid) return;

		scheduledStore.add(text, whenTs, target === 'here' ? activeConvId : undefined);
		text = '';
		scheduledStore.draft = '';
	}

	function fmt(ts: number): string {
		return new Date(ts).toLocaleString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function relative(ts: number): string {
		const diff = Math.round((ts - now) / 60_000);

		if (diff <= 0) return 'due now';
		if (diff < 60) return `in ${diff} min`;
		if (diff < 60 * 24) return `in ${Math.round(diff / 60)} h`;

		return `in ${Math.round(diff / 1440)} d`;
	}

	function chatName(m: ScheduledMessage): string {
		if (!m.convId) return 'New chat';

		return conversationsStore.conversations.find((c) => c.id === m.convId)?.name ?? 'New chat';
	}

	const visible = $derived(
		[...scheduledStore.items].sort((a, b) => a.at - b.at).filter((m) => m.status !== 'sent')
	);
	const hasSent = $derived(scheduledStore.items.some((m) => m.status === 'sent'));
</script>

<Dialog.Root bind:open={scheduledStore.dialogOpen}>
	<Dialog.Content
		class="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:rounded-2xl"
	>
		<Dialog.Title class="sr-only">Scheduled messages</Dialog.Title>

		<div class="flex items-center gap-2 border-b border-border/60 px-5 py-4 text-lg font-semibold">
			<CalendarClock class="h-5 w-5 text-primary" />
			Scheduled message
		</div>

		<div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
			<div class="space-y-2">
				<Textarea
					bind:value={text}
					class="min-h-24 rounded-xl"
					placeholder="What should be sent?"
				/>

				<div class="flex flex-wrap gap-1.5">
					{#each presets as p (p.label)}
						<button
							class="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted/60 {Math.abs(
								whenTs - p.ts
							) < 60_000
								? 'border-primary bg-primary/10'
								: 'border-border'}"
							onclick={() => (whenLocal = toLocalInput(p.ts))}
							type="button"
						>
							{p.label}
						</button>
					{/each}
				</div>

				<div class="flex flex-wrap items-center gap-3">
					<input
						bind:value={whenLocal}
						class="rounded-xl border border-input bg-background px-3 py-2 text-sm"
						type="datetime-local"
					/>

					<div class="flex rounded-xl border border-border p-0.5 text-sm">
						<button
							class="rounded-lg px-3 py-1 transition-colors {target === 'here'
								? 'bg-primary/10 font-medium'
								: 'text-muted-foreground'}"
							disabled={!activeConvId}
							onclick={() => (target = 'here')}
							type="button"
						>
							This chat
						</button>
						<button
							class="rounded-lg px-3 py-1 transition-colors {target === 'new'
								? 'bg-primary/10 font-medium'
								: 'text-muted-foreground'}"
							onclick={() => (target = 'new')}
							type="button"
						>
							New chat
						</button>
					</div>
				</div>

				<div class="flex items-center justify-between gap-3 pt-1">
					<p class="text-xs text-muted-foreground">
						Sent automatically while Knome is open in this browser. If it was closed, the message
						waits here as "Missed".
					</p>

					<Button class="shrink-0 rounded-xl" disabled={!valid} onclick={schedule}>
						<CalendarClock class="h-4 w-4" />
						Schedule
					</Button>
				</div>
			</div>

			<div class="space-y-2">
				<h3 class="text-sm font-semibold">
					Waiting <span class="font-normal text-muted-foreground">({visible.length})</span>
				</h3>

				{#if visible.length === 0}
					<p
						class="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
					>
						Nothing scheduled.
					</p>
				{:else}
					<ul class="space-y-2">
						{#each visible as m (m.id)}
							<li class="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3">
								<div class="min-w-0 flex-1">
									<p class="line-clamp-2 text-sm">{m.text}</p>
									<p class="mt-1 text-xs text-muted-foreground">
										{fmt(m.at)} ·
										{#if m.status === 'missed'}
											<span class="font-medium text-destructive">Missed</span>
										{:else}
											{relative(m.at)}
										{/if}
										· {chatName(m)}
									</p>
								</div>

								<Button
									aria-label="Send now"
									class="h-8 w-8 shrink-0"
									onclick={() => scheduledStore.sendNow(m.id)}
									size="icon"
									title="Send now"
									variant="ghost"
								>
									<Send class="h-4 w-4" />
								</Button>

								<Button
									aria-label="Remove"
									class="h-8 w-8 shrink-0"
									onclick={() => scheduledStore.remove(m.id)}
									size="icon"
									title="Remove"
									variant="ghost"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if hasSent}
					<button
						class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
						onclick={() => scheduledStore.clearFinished()}
						type="button"
					>
						<Check class="h-3.5 w-3.5" /> Clear sent messages from the list
					</button>
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
