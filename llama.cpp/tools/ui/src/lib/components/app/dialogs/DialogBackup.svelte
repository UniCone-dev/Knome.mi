<script lang="ts">
	import { Archive, Download, Upload } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { charactersStore, conversationsStore, settingsStore } from '$lib/stores';
	import { memoryStore } from '$lib/stores/memory.svelte';

	interface Props {
		open: boolean;
		mode: 'export' | 'import';
	}

	let { open = $bindable(false), mode }: Props = $props();

	type Parts = 'chats' | 'characters' | 'memory' | 'settings';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let loaded = $state<any>(null);
	let fileName = $state('');
	let pick = $state<Record<Parts, boolean>>({
		chats: true,
		characters: true,
		memory: true,
		settings: false
	});
	let busy = $state(false);

	const characters = $derived(charactersStore.characters);

	function counts(): Record<Parts, number> {
		if (mode === 'import') {
			return {
				chats: loaded?.chats?.length ?? 0,
				characters: loaded?.characters?.length ?? 0,
				memory: loaded?.memory?.length ?? 0,
				settings: loaded?.settings ? 1 : 0
			};
		}

		return {
			chats: conversationsStore.conversations.length,
			characters: characters.length,
			memory: memoryStore.items.length,
			settings: 1
		};
	}

	const c = $derived(counts());
	const rows: { key: Parts; title: string; sub: string }[] = [
		{ key: 'chats', title: 'Chats', sub: 'All conversations with messages and attachments' },
		{
			key: 'characters',
			title: 'Characters',
			sub: 'Character cards and personas, portraits included'
		},
		{ key: 'memory', title: 'Memory', sub: 'Things the AI remembers about you' },
		{ key: 'settings', title: 'Settings', sub: 'Your preferences (private keys are not included)' }
	];

	$effect(() => {
		if (open) {
			loaded = null;
			fileName = '';
			pick = { chats: true, characters: true, memory: true, settings: false };
		}
	});

	async function doExport() {
		busy = true;

		try {
			const out: Record<string, unknown> = { knomeBackup: 1, exportedAt: new Date().toISOString() };

			if (pick.chats) {
				out.chats = await conversationsStore.getConversationsForExport(
					conversationsStore.conversations.map((x: DatabaseConversation) => x.id)
				);
			}

			if (pick.characters) {
				out.characters = characters.map((ch) => ({
					id: ch.id,
					name: ch.name,
					gender: ch.gender,
					avatarUrl: ch.avatarUrl,
					avatarKind: ch.avatarKind,
					description: ch.description,
					personality: ch.personality,
					firstMessage: ch.firstMessage,
					tags: ch.tags,
					isUserPersona: ch.isUserPersona
				}));
			}

			if (pick.memory) out.memory = memoryStore.items;
			if (pick.settings) out.settings = settingsStore.exportSettings(false);

			const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
			const a = document.createElement('a');

			a.href = URL.createObjectURL(blob);
			a.download = `knome_backup_${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(a.href);
			toast.success('Backup exported');
			open = false;
		} catch (err) {
			console.error(err);
			toast.error('Backup failed');
		} finally {
			busy = false;
		}
	}

	function chooseFile() {
		const input = document.createElement('input');

		input.type = 'file';
		input.accept = '.json,application/json';
		input.onchange = async () => {
			const file = input.files?.[0];

			if (!file) return;

			try {
				const data = JSON.parse(await file.text());

				if (!data?.knomeBackup) throw new Error('not a backup');

				loaded = data;
				fileName = file.name;
				pick = {
					chats: !!data.chats?.length,
					characters: !!data.characters?.length,
					memory: !!data.memory?.length,
					settings: false
				};
			} catch {
				toast.error('That is not a Knome backup file');
			}
		};
		input.click();
	}

	async function doImport() {
		if (!loaded) return;

		busy = true;

		try {
			const done: string[] = [];

			if (pick.characters && loaded.characters?.length) {
				await charactersStore.initialize();

				let n = 0;

				for (const ch of loaded.characters) {
					const exists = charactersStore.characters.some(
						(x) =>
							x.id === ch.id || (x.name === ch.name && !!x.isUserPersona === !!ch.isUserPersona)
					);

					if (!exists && ch.name) {
						const { id: _id, ...rest } = ch;

						await charactersStore.createCharacter(rest);
						n++;
					}
				}

				done.push(`${n} characters`);
			}

			if (pick.chats && loaded.chats?.length) {
				const r = await conversationsStore.importConversationsData(loaded.chats, 'auto');

				done.push(`${r.imported.length} chats`);
			}

			if (pick.memory && loaded.memory?.length) {
				done.push(`${memoryStore.importData(loaded.memory)} memories`);
			}

			if (pick.settings && loaded.settings) {
				settingsStore.importSettings(loaded.settings);
				done.push('settings');
			}

			toast.success(done.length ? `Imported: ${done.join(', ')}` : 'Nothing selected');
			open = false;
		} catch (err) {
			console.error(err);
			toast.error('Import failed');
		} finally {
			busy = false;
		}
	}

	const anyPicked = $derived(rows.some((r) => pick[r.key] && c[r.key] > 0));
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex max-h-[88dvh] flex-col gap-4 overflow-y-auto sm:max-w-lg md:rounded-2xl"
	>
		<Dialog.Title class="flex items-center gap-2 text-lg font-semibold">
			<Archive class="h-5 w-5 text-primary" />
			{mode === 'export' ? 'Export a backup' : 'Import a backup'}
		</Dialog.Title>

		{#if mode === 'import' && !loaded}
			<p class="text-sm text-muted-foreground">
				Choose a Knome backup file (knome_backup_….json). You then pick what to bring in.
			</p>
			<Button class="self-start rounded-xl" onclick={chooseFile}>
				<Upload class="h-4 w-4" /> Choose file
			</Button>
		{:else}
			{#if mode === 'import'}
				<p class="truncate text-sm text-muted-foreground">{fileName}</p>
			{/if}

			<ul class="space-y-2">
				{#each rows as r (r.key)}
					<li>
						<label
							class="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 {c[
								r.key
							] === 0
								? 'opacity-50'
								: ''}"
						>
							<input
								bind:checked={pick[r.key]}
								class="h-4 w-4"
								disabled={c[r.key] === 0}
								type="checkbox"
							/>
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-medium">
									{r.title}
									{#if r.key !== 'settings'}
										<span class="font-normal text-muted-foreground">({c[r.key]})</span>
									{/if}
								</span>
								<span class="block text-xs text-muted-foreground">{r.sub}</span>
							</span>
						</label>
					</li>
				{/each}
			</ul>

			{#if mode === 'import'}
				<p class="text-xs text-muted-foreground">
					Import adds to what you have: existing chats and characters are not duplicated, memory is
					merged.
				</p>
			{/if}

			<Button
				class="self-end rounded-xl"
				disabled={!anyPicked || busy}
				onclick={mode === 'export' ? doExport : doImport}
			>
				{#if mode === 'export'}
					<Download class="h-4 w-4" /> Export selected
				{:else}
					<Upload class="h-4 w-4" /> Import selected
				{/if}
			</Button>
		{/if}
	</Dialog.Content>
</Dialog.Root>
