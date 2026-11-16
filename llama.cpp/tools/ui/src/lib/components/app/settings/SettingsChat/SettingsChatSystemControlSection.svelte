<script lang="ts">
	import { Check, Pencil, ShieldAlert, Terminal, Trash2, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { isSystemControlTool } from '$lib/constants';
	import { commandMemoryStore } from '$lib/stores/command-memory.svelte';
	import { toolsStore } from '$lib/stores/tools.svelte';

	let editingId = $state('');
	let editText = $state('');

	let available = $derived(
		toolsStore.allTools.some((t) => isSystemControlTool(t.definition.function.name))
	);

	function startEdit(id: string, task: string) {
		editingId = id;
		editText = task;
	}

	function saveEdit() {
		commandMemoryStore.updateTask(editingId, editText);
		editingId = '';
	}

	function clearAll() {
		if (confirm('Delete all remembered commands? This cannot be undone.')) commandMemoryStore.clear();
	}
</script>

<div class="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
	<div class="flex items-start gap-3">
		<Terminal class="mt-0.5 h-5 w-5 text-primary" />

		<div class="min-w-0 flex-1">
			<h3 class="text-base font-semibold">System control</h3>
			<p class="text-sm text-muted-foreground">
				{#if available}
					<strong class="text-foreground">On.</strong> The AI can open apps, play media, change volume
					or brightness, install or remove apps and run terminal commands on this computer.
				{:else}
					<strong class="text-foreground">Off.</strong> Turn it on in the terminal with
					<code>./Knome-start.sh --settings</code>
					and start Knome again.
				{/if}
			</p>
		</div>
	</div>

	<div
		class="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
	>
		<ShieldAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />

		<div class="space-y-1">
			<p class="font-medium">Warning and risk</p>
			<ul class="list-disc space-y-0.5 pl-4 text-muted-foreground">
				<li>A terminal command can delete files, change settings or break your system.</li>
				<li>
					Every single action asks you first. Read the command in the card, then choose
					<em>Allow once</em> or <em>Deny</em>. "Always allow" does not exist for this tool.
				</li>
				<li>
					Install and remove use your system's own password window. sudo is never used by the AI.
				</li>
				<li>
					A small safety list blocks the worst commands, but it is only a seatbelt: your reading is
					the real protection. A model can also make mistakes.
				</li>
			</ul>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<h4 class="min-w-0 flex-1 text-sm font-semibold">Command memory</h4>

		<label class="flex items-center gap-2 text-sm">
			Use it
			<Switch
				checked={commandMemoryStore.enabled}
				onCheckedChange={(v) => commandMemoryStore.setEnabled(v)}
			/>
		</label>
	</div>

	<p class="text-sm text-muted-foreground">
		Commands that you allowed and that worked on this computer. The AI sees this list and reuses
		them instead of guessing; if it does not know a command it searches the web first. Saved only
		in this browser. A saved command still asks you before every run.
	</p>

	{#if commandMemoryStore.items.length === 0}
		<p
			class="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground"
		>
			No commands yet. They appear here after you allow one and it works.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each commandMemoryStore.items as m (m.id)}
				<li class="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3">
					<div class="min-w-0 flex-1 space-y-1">
						{#if editingId === m.id}
							<input
								bind:value={editText}
								class="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
							/>
						{:else}
							<p class="text-sm font-medium break-words">{m.task}</p>
						{/if}

						<code class="block rounded-lg bg-muted/60 px-2 py-1 text-xs break-all whitespace-pre-wrap"
							>{m.command}</code
						>

						<p class="text-xs text-muted-foreground">
							worked {m.uses} {m.uses === 1 ? 'time' : 'times'}
						</p>
					</div>

					{#if editingId === m.id}
						<Button aria-label="Save" class="h-8 w-8" onclick={saveEdit} size="icon" variant="ghost">
							<Check class="h-4 w-4" />
						</Button>
						<Button
							aria-label="Cancel"
							class="h-8 w-8"
							onclick={() => (editingId = '')}
							size="icon"
							variant="ghost"
						>
							<X class="h-4 w-4" />
						</Button>
					{:else}
						<Button
							aria-label="Rename"
							class="h-8 w-8"
							onclick={() => startEdit(m.id, m.task)}
							size="icon"
							variant="ghost"
						>
							<Pencil class="h-4 w-4" />
						</Button>
						<Button
							aria-label="Delete"
							class="h-8 w-8"
							onclick={() => commandMemoryStore.remove(m.id)}
							size="icon"
							variant="ghost"
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					{/if}
				</li>
			{/each}
		</ul>

		<Button class="rounded-xl text-destructive" onclick={clearAll} variant="ghost">
			<Trash2 class="h-4 w-4" /> Delete all
		</Button>
	{/if}
</div>
