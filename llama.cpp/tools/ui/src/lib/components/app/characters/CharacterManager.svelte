<script lang="ts">
	import { Check, Download, Plus, Upload } from '@lucide/svelte';
	import { CharacterEditor } from '$lib/components/app/characters';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Switch } from '$lib/components/ui/switch';
	import {
		AVATAR_SHAPES,
		MAX_AVATAR_SIZE,
		MAX_BACKGROUND_BLUR,
		MIN_AVATAR_SIZE,
		MIN_BACKGROUND_BLUR
	} from '$lib/stores/characters/index.svelte';
	import type { AvatarShape } from '$lib/stores/characters/index.svelte';
	import { charactersStore } from '$lib/stores';
	import type { DatabaseCharacter } from '$lib/types/database';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	let view = $state<'list' | 'edit'>('list');
	let editingCharacter = $state<DatabaseCharacter | null>(null);
	let editingIsPersona = $state(false);
	let importInput = $state<HTMLInputElement | null>(null);
	let bgInput = $state<HTMLInputElement | null>(null);

	function handleBackgroundFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];

		if (!file || !file.type.startsWith('image/')) return;

		const reader = new FileReader();

		reader.onload = () => {
			charactersStore.setChatBackground(reader.result as string);
		};

		reader.readAsDataURL(file);
		(event.target as HTMLInputElement).value = '';
	}

	charactersStore.initialize();

	function openNewCharacter() {
		editingCharacter = null;
		editingIsPersona = false;
		view = 'edit';
	}

	function openEdit(character: DatabaseCharacter) {
		editingCharacter = character;
		editingIsPersona = character.isUserPersona ?? false;
		view = 'edit';
	}

	async function handleSave(data: Omit<DatabaseCharacter, 'id' | 'createdAt' | 'lastModified'>) {
		if (editingCharacter) {
			await charactersStore.updateCharacter(editingCharacter.id, data);
		} else {
			await charactersStore.createCharacter(data);
		}

		view = 'list';
		editingCharacter = null;
	}

	async function handleDelete() {
		if (!editingCharacter) return;

		await charactersStore.deleteCharacter(editingCharacter.id);
		view = 'list';
		editingCharacter = null;
	}

	function handleCancel() {
		view = 'list';
		editingCharacter = null;
	}

	function toggleActiveCharacter(id: string) {
		charactersStore.setActiveCharacter(charactersStore.activeCharacterId === id ? undefined : id);
	}

	async function handleImportFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];

		if (!file) return;

		await charactersStore.importCharacterFromFile(file);

		if (importInput) importInput.value = '';
	}
</script>

{#snippet card(character: DatabaseCharacter, isActive: boolean, onToggleActive: () => void)}
	<div
		class="group flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors {isActive
			? 'bg-accent/60 ring-1 ring-primary/40'
			: 'hover:bg-muted/60'}"
	>
		<button
			class="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
			onclick={() => openEdit(character)}
			type="button"
		>
			{#if character.avatarUrl}
				{#if character.avatarKind === 'video'}
					<video
						autoplay
						class="h-full w-full object-cover"
						loop
						muted
						playsinline
						src={character.avatarUrl}
					></video>
				{:else}
					<img alt={character.name} class="h-full w-full object-cover" src={character.avatarUrl} />
				{/if}
			{/if}
		</button>

		<button class="min-w-0 flex-1 text-left" onclick={() => openEdit(character)} type="button">
			<p class="truncate text-sm font-medium">{character.name}</p>

			{#if character.tags?.length}
				<p class="truncate text-xs text-muted-foreground">{character.tags.join(', ')}</p>
			{/if}
		</button>

		<Button
			class="flex-shrink-0"
			onclick={onToggleActive}
			size="sm"
			variant={isActive ? 'default' : 'outline'}
		>
			{#if isActive}
				<Check class="h-3.5 w-3.5" />
			{/if}
			{isActive ? 'Active' : 'Set active'}
		</Button>

		<Button
			aria-label="Export {character.name}"
			onclick={() => charactersStore.exportCharacter(character.id)}
			size="icon"
			variant="ghost"
		>
			<Download class="h-3.5 w-3.5" />
		</Button>
	</div>
{/snippet}

<div class={className}>
	{#if view === 'edit'}
		<CharacterEditor
			character={editingCharacter}
			isUserPersona={editingIsPersona}
			onCancel={handleCancel}
			onDelete={editingCharacter ? handleDelete : undefined}
			onSave={handleSave}
		/>
	{:else}
		<ScrollArea class="h-full">
			<div class="flex flex-col gap-6 pr-2">
				<section class="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
					<h3 class="text-sm font-semibold">Display</h3>

					<div class="flex items-center justify-between gap-3">
						<Label for="show-avatars-toggle">Show avatars beside chat messages</Label>
						<Switch
							id="show-avatars-toggle"
							checked={charactersStore.showAvatarsInChat}
							onCheckedChange={(v) => charactersStore.setShowAvatarsInChat(v)}
						/>
					</div>

					{#if charactersStore.showAvatarsInChat}
						<div class="flex items-center gap-3">
							<Label class="flex-shrink-0" for="avatar-size-slider">Avatar size</Label>
							<input
								id="avatar-size-slider"
								class="flex-1"
								max={MAX_AVATAR_SIZE}
								min={MIN_AVATAR_SIZE}
								oninput={(e) =>
									charactersStore.setAvatarSize(Number((e.target as HTMLInputElement).value))}
								type="range"
								value={charactersStore.avatarSize}
							/>
							<span class="w-10 flex-shrink-0 text-right text-xs text-muted-foreground">
								{charactersStore.avatarSize}px
							</span>
						</div>

						<div class="flex items-start justify-between gap-3">
							<Label class="mt-1 flex-shrink-0">Avatar shape</Label>
							<div class="flex flex-wrap justify-end gap-1.5">
								{#each AVATAR_SHAPES as opt (opt.value)}
									<button
										class="rounded-md border px-2.5 py-1 text-xs transition-colors {charactersStore.avatarShape ===
										opt.value
											? 'border-primary bg-primary/10 text-primary'
											: 'border-border text-muted-foreground hover:bg-accent'}"
										onclick={() => charactersStore.setAvatarShape(opt.value as AvatarShape)}
										type="button"
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<div class="border-t border-border pt-3">
						<Label class="mb-1.5 block">Layout</Label>
						<div class="flex gap-1.5">
							<button
								class="flex-1 rounded-md border px-3 py-2 text-sm transition-colors {charactersStore.layoutMode ===
								'normal'
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border text-muted-foreground hover:bg-accent'}"
								onclick={() => charactersStore.setLayoutMode('normal')}
								type="button"
							>
								Classic
							</button>
							<button
								class="flex-1 rounded-md border px-3 py-2 text-sm transition-colors {charactersStore.layoutMode ===
								'whatsapp'
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border text-muted-foreground hover:bg-accent'}"
								onclick={() => charactersStore.setLayoutMode('whatsapp')}
								type="button"
							>
								Messenger
							</button>
						</div>
						<p class="mt-1.5 text-xs text-muted-foreground">
							Messenger: a chat-app layout. The sidebar is your list of characters; tap one to open
							your chat with them. Tap their name at the top for their details and every chat you
							had with them. Settings and other options sit in the menu at the top of the list.
						</p>
					</div>

					<div class="border-t border-border pt-3">
						<div class="flex items-center justify-between gap-3">
							<Label for="chat-header-toggle">Show chat header</Label>
							<Switch
								id="chat-header-toggle"
								checked={charactersStore.showChatHeader}
								onCheckedChange={(v) => charactersStore.setShowChatHeader(v)}
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							A bar at the top of the chat showing who you're talking to, like a messaging app.
						</p>
					</div>

					<div class="border-t border-border pt-3">
						<div class="flex items-center justify-between gap-3">
							<Label>Chat background</Label>
							<div class="flex gap-1.5">
								<Button onclick={() => bgInput?.click()} size="sm" variant="secondary">
									Choose image
								</Button>
								{#if charactersStore.chatBackgroundUrl}
									<Button
										onclick={() => charactersStore.setChatBackground(undefined)}
										size="sm"
										variant="ghost"
									>
										Clear
									</Button>
								{/if}
							</div>
							<input
								bind:this={bgInput}
								accept="image/*"
								class="hidden"
								onchange={handleBackgroundFile}
								type="file"
							/>
						</div>

						{#if charactersStore.chatBackgroundUrl}
							<div class="mt-2 flex items-center gap-3">
								<Label class="flex-shrink-0" for="bg-blur-slider">Blur</Label>
								<input
									id="bg-blur-slider"
									class="flex-1"
									max={MAX_BACKGROUND_BLUR}
									min={MIN_BACKGROUND_BLUR}
									onchange={(e) =>
										charactersStore.setChatBackgroundBlur(
											Number((e.target as HTMLInputElement).value)
										)}
									type="range"
									value={charactersStore.chatBackgroundBlur}
								/>
								<span class="w-10 flex-shrink-0 text-right text-xs text-muted-foreground">
									{charactersStore.chatBackgroundBlur}px
								</span>
							</div>
						{/if}
					</div>

					<div class="border-t border-border pt-3">
						<div class="flex items-center justify-between gap-3">
							<Label for="ai-bubble-toggle">AI messages in a bubble</Label>
							<Switch
								id="ai-bubble-toggle"
								checked={charactersStore.showAiBubble}
								onCheckedChange={(v) => charactersStore.setShowAiBubble(v)}
							/>
						</div>

						<div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
							<div class="flex items-center justify-between gap-2">
								<Label class="text-xs" for="user-bubble-color">Your bubble</Label>
								<input
									id="user-bubble-color"
									class="h-6 w-10 rounded border border-border"
									onchange={(e) =>
										charactersStore.setBubbleColors({
											userBubbleColor: (e.target as HTMLInputElement).value
										})}
									type="color"
									value={charactersStore.userBubbleColor ?? '#6366f1'}
								/>
							</div>
							<div class="flex items-center justify-between gap-2">
								<Label class="text-xs" for="user-text-color">Your text</Label>
								<input
									id="user-text-color"
									class="h-6 w-10 rounded border border-border"
									onchange={(e) =>
										charactersStore.setBubbleColors({
											userTextColor: (e.target as HTMLInputElement).value
										})}
									type="color"
									value={charactersStore.userTextColor ?? '#ffffff'}
								/>
							</div>
							<div class="flex items-center justify-between gap-2">
								<Label class="text-xs" for="ai-bubble-color">AI bubble</Label>
								<input
									id="ai-bubble-color"
									class="h-6 w-10 rounded border border-border"
									onchange={(e) =>
										charactersStore.setBubbleColors({
											aiBubbleColor: (e.target as HTMLInputElement).value
										})}
									type="color"
									value={charactersStore.aiBubbleColor ?? '#27272a'}
								/>
							</div>
							<div class="flex items-center justify-between gap-2">
								<Label class="text-xs" for="ai-text-color">AI text</Label>
								<input
									id="ai-text-color"
									class="h-6 w-10 rounded border border-border"
									onchange={(e) =>
										charactersStore.setBubbleColors({
											aiTextColor: (e.target as HTMLInputElement).value
										})}
									type="color"
									value={charactersStore.aiTextColor ?? '#ffffff'}
								/>
							</div>
						</div>

						{#if charactersStore.userBubbleColor || charactersStore.userTextColor || charactersStore.aiBubbleColor || charactersStore.aiTextColor}
							<Button
								class="mt-2"
								onclick={() =>
									charactersStore.setBubbleColors({
										aiBubbleColor: undefined,
										aiTextColor: undefined,
										userBubbleColor: undefined,
										userTextColor: undefined
									})}
								size="sm"
								variant="ghost"
							>
								Reset colors
							</Button>
						{/if}
					</div>
				</section>

				<section class="flex flex-col gap-2">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold">AI Characters</h3>

						<div class="flex gap-1">
							<Button onclick={() => importInput?.click()} size="sm" variant="ghost">
								<Upload class="h-3.5 w-3.5" />
								Import
							</Button>
							<Button onclick={openNewCharacter} size="sm" variant="secondary">
								<Plus class="h-3.5 w-3.5" />
								New character
							</Button>
						</div>

						<input
							bind:this={importInput}
							accept="application/json"
							class="hidden"
							onchange={handleImportFile}
							type="file"
						/>
					</div>

					{#if charactersStore.aiCharacters.length === 0}
						<p class="text-sm text-muted-foreground">
							No characters yet -- create one, or import a character card.
						</p>
					{:else}
						<div class="flex flex-col gap-1.5">
							{#each charactersStore.aiCharacters as character (character.id)}
								{@render card(character, charactersStore.activeCharacterId === character.id, () =>
									toggleActiveCharacter(character.id)
								)}
							{/each}
						</div>
					{/if}

					<p class="text-xs text-muted-foreground">
						The active character's personality is applied to every new chat, app-wide, until you
						change or clear it.
					</p>
				</section>
			</div>
		</ScrollArea>
	{/if}
</div>
