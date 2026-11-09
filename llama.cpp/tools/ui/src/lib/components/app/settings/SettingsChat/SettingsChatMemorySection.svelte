<script lang="ts">
	import { Brain, Download, Pencil, Plus, Trash2, Upload, X, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { memoryStore } from '$lib/stores/memory.svelte';

	let draft = $state('');
	let editingId = $state('');
	let editText = $state('');

	function add() {
		if (!draft.trim()) return;

		if (!memoryStore.add(draft)) toast.info('Already in memory');

		draft = '';
	}

	function startEdit(id: string, text: string) {
		editingId = id;
		editText = text;
	}

	function saveEdit() {
		memoryStore.update(editingId, editText);
		editingId = '';
	}

	function exportMemory() {
		const blob = new Blob([JSON.stringify(memoryStore.exportData(), null, 2)], {
			type: 'application/json'
		});
		const a = document.createElement('a');

		a.href = URL.createObjectURL(blob);
		a.download = `knome_memory_${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	function importMemory() {
		const input = document.createElement('input');

		input.type = 'file';
		input.accept = '.json,application/json';
		input.onchange = async () => {
			const file = input.files?.[0];

			if (!file) return;

			try {
				const n = memoryStore.importData(JSON.parse(await file.text()));

				toast.success(n > 0 ? `${n} memories imported` : 'Nothing new to import');
			} catch {
				toast.error('That file is not a memory export');
			}
		};
		input.click();
	}

	function clearAll() {
		if (confirm('Delete all saved memories? This cannot be undone.')) memoryStore.clear();
	}
</script>

<div class="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4">
	<div class="flex items-start gap-3">
		<Brain class="mt-0.5 h-5 w-5 text-primary" />

		<div class="min-w-0 flex-1">
			<h3 class="text-base font-semibold">Memory</h3>
			<p class="text-sm text-muted-foreground">
				Things the AI should always remember about you. Saved in this browser, shown here, and added
				to every chat when switched on.
			</p>
		</div>

		<label class="flex items-center gap-2 text-sm">
			Use memory
			<Switch checked={memoryStore.enabled} onCheckedChange={(v) => memoryStore.setEnabled(v)} />
		</label>
	</div>

	<form
		class="flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			add();
		}}
	>
		<input
			bind:value={draft}
			class="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
			placeholder="e.g. I prefer short answers. My dog is called Bruno."
		/>
		<Button class="rounded-xl" disabled={!draft.trim()} type="submit">
			<Plus class="h-4 w-4" /> Add
		</Button>
	</form>

	{#if memoryStore.items.length === 0}
		<p
			class="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
		>
			Nothing remembered yet.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each memoryStore.items as m (m.id)}
				<li class="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-3">
					{#if editingId === m.id}
						<textarea
							bind:value={editText}
							class="min-h-16 min-w-0 flex-1 rounded-lg border border-input bg-background p-2 text-sm"
						></textarea>
						<Button
							aria-label="Save"
							class="h-8 w-8"
							onclick={saveEdit}
							size="icon"
							variant="ghost"
						>
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
						<p class="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">{m.text}</p>
						<Button
							aria-label="Edit"
							class="h-8 w-8"
							onclick={() => startEdit(m.id, m.text)}
							size="icon"
							variant="ghost"
						>
							<Pencil class="h-4 w-4" />
						</Button>
						<Button
							aria-label="Delete"
							class="h-8 w-8"
							onclick={() => memoryStore.remove(m.id)}
							size="icon"
							variant="ghost"
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="flex flex-wrap gap-2">
		<Button
			class="rounded-xl"
			disabled={memoryStore.items.length === 0}
			onclick={exportMemory}
			variant="outline"
		>
			<Download class="h-4 w-4" /> Export memory
		</Button>
		<Button class="rounded-xl" onclick={importMemory} variant="outline">
			<Upload class="h-4 w-4" /> Import memory
		</Button>
		{#if memoryStore.items.length > 0}
			<Button class="rounded-xl text-destructive" onclick={clearAll} variant="ghost">
				<Trash2 class="h-4 w-4" /> Delete all
			</Button>
		{/if}
	</div>
</div>
