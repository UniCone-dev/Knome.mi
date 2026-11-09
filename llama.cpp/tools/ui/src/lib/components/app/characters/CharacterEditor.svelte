<script lang="ts">
	import { Image, Sparkles, Trash2, Upload, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ROUTES } from '$lib/constants';
	import { conversationsStore, draftMessagesStore } from '$lib/stores';
	import type { DatabaseCharacter } from '$lib/types/database';
	import { toast } from 'svelte-sonner';

	interface Props {
		character?: DatabaseCharacter | null;
		/** Only used when creating (character is null/undefined). */
		isUserPersona?: boolean;
		onSave: (data: Omit<DatabaseCharacter, 'id' | 'createdAt' | 'lastModified'>) => void;
		onCancel: () => void;
		onDelete?: () => void;
	}

	let { character = null, isUserPersona = false, onCancel, onDelete, onSave }: Props = $props();

	const editingUserPersona = character ? Boolean(character.isUserPersona) : isUserPersona;

	let name = $state(character?.name ?? '');
	let gender = $state(character?.gender ?? '');
	let description = $state(character?.description ?? '');
	let personality = $state(character?.personality ?? '');
	let firstMessage = $state(character?.firstMessage ?? '');
	let tagsText = $state((character?.tags ?? []).join(', '));
	let avatarUrl = $state(character?.avatarUrl ?? '');
	let avatarKind = $state<'image' | 'gif' | 'video' | undefined>(character?.avatarKind);

	let fileInput = $state<HTMLInputElement | null>(null);
	let assistReply = $state('');

	const MAX_AVATAR_BYTES = 15 * 1024 * 1024; // 15MB -- generous for a short mp4 loop

	function handleAvatarPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];

		if (!file) return;

		if (file.size > MAX_AVATAR_BYTES) {
			toast.error('Avatar file is too large (max 15MB)');

			return;
		}

		const kind: 'image' | 'gif' | 'video' = file.type.startsWith('video/')
			? 'video'
			: file.type === 'image/gif'
				? 'gif'
				: 'image';

		const reader = new FileReader();

		reader.onload = () => {
			avatarUrl = reader.result as string;
			avatarKind = kind;
		};
		reader.onerror = () => toast.error('Failed to read avatar file');
		reader.readAsDataURL(file);
	}

	function removeAvatar() {
		avatarUrl = '';
		avatarKind = undefined;

		if (fileInput) fileInput.value = '';
	}

	function dataUrlToFile(dataUrl: string, filename: string): File | null {
		const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);

		if (!match) return null;

		const mime = match[1];
		const binary = atob(match[2]);
		const bytes = new Uint8Array(binary.length);

		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

		return new File([bytes], filename, { type: mime });
	}

	const JSON_SCHEMA_INSTRUCTIONS =
		'Reply with ONLY a single JSON object (no other text, no markdown fence) with exactly ' +
		'these keys: "description" (appearance & background), "personality" (how they speak and ' +
		'act -- concrete behavior instructions for roleplaying them), "gender" (short, free text), ' +
		'and "tags" (a comma-separated string of a few short tags).';

	/**
	 * Sends a crafted prompt into a brand-new chat via the app's normal send
	 * flow (optionally with the current avatar attached), so the actual
	 * active model does the real work -- vision analysis or web research --
	 * exactly as if the user had typed and attached it themselves. The
	 * editor stays open in the background; the user comes back and pastes
	 * the reply into "AI reply" below to auto-fill the fields.
	 */
	async function openInNewChat(promptText: string, attachAvatar: boolean) {
		const files = [];

		if (attachAvatar && avatarUrl && avatarKind !== 'video') {
			const file = dataUrlToFile(avatarUrl, `${name || 'character'}-avatar.png`);

			if (file) {
				files.push({
					file,
					id: crypto.randomUUID(),
					name: file.name,
					preview: avatarUrl,
					size: file.size,
					type: file.type
				});
			}
		}

		draftMessagesStore.saveDraftMessage(undefined, promptText, files);
		await conversationsStore.openNewChat();
		await goto(ROUTES.START);

		toast.success('Prompt ready in a new chat -- hit send, then paste the reply back here');
	}

	function describeFromPortrait() {
		if (!avatarUrl || avatarKind === 'video') {
			toast.error(
				'Upload an image or GIF avatar first (video portraits need a manual description)'
			);

			return;
		}

		const who = name.trim() || 'this character';

		void openInNewChat(
			`Look closely at the attached portrait and write a character profile for "${who}" based on what you see (appearance, likely personality from their expression/style). ${JSON_SCHEMA_INSTRUCTIONS}`,
			true
		);
	}

	function researchCharacter() {
		const who = name.trim();

		if (!who) {
			toast.error('Enter a name first so there is something to research');

			return;
		}

		void openInNewChat(
			`"${who}" may be a pre-existing character (anime/game/movie/book/etc). Research them using your ` +
				'web search, Wikipedia and page-reading tools, then write a proper profile in your own words. ' +
				'Once you are done, also call the save_character_profile tool to save it to disk. ' +
				JSON_SCHEMA_INSTRUCTIONS,
			false
		);
	}

	function autofillFromReply() {
		const raw = assistReply.trim();

		if (!raw) return;

		const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
		const jsonText = fenceMatch ? fenceMatch[1] : raw;

		try {
			const parsed = JSON.parse(jsonText) as Record<string, unknown>;

			if (typeof parsed.description === 'string') description = parsed.description;
			if (typeof parsed.personality === 'string') personality = parsed.personality;
			if (typeof parsed.gender === 'string') gender = parsed.gender;
			if (typeof parsed.tags === 'string') tagsText = parsed.tags;
			else if (Array.isArray(parsed.tags)) tagsText = parsed.tags.join(', ');

			toast.success('Fields filled in from the reply -- review and adjust as needed');
		} catch {
			toast.error(
				'Could not find valid JSON in that reply -- you can still fill the fields by hand'
			);
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();

		const trimmedName = name.trim();

		if (!trimmedName) {
			toast.error('Give the character a name');

			return;
		}

		onSave({
			avatarKind,
			avatarUrl: avatarUrl || undefined,
			description: description.trim() || undefined,
			firstMessage: firstMessage.trim() || undefined,
			gender: gender.trim() || undefined,
			isUserPersona: editingUserPersona,
			name: trimmedName,
			personality: personality.trim() || undefined,
			tags: tagsText
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean)
		});
	}
</script>

<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
	<div class="flex items-start gap-4">
		<div class="relative flex-shrink-0">
			{#if avatarUrl}
				<div class="relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-muted">
					{#if avatarKind === 'video'}
						<video
							autoplay
							class="h-full w-full object-cover"
							loop
							muted
							playsinline
							src={avatarUrl}
						></video>
					{:else}
						<img alt="Avatar preview" class="h-full w-full object-cover" src={avatarUrl} />
					{/if}
				</div>

				<button
					aria-label="Remove avatar"
					class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent"
					onclick={removeAvatar}
					type="button"
				>
					<X class="h-3.5 w-3.5" />
				</button>
			{:else}
				<button
					class="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted text-muted-foreground hover:bg-accent"
					onclick={() => fileInput?.click()}
					type="button"
				>
					<Image class="h-5 w-5" />
					<span class="text-[10px]">Add avatar</span>
				</button>
			{/if}

			<input
				bind:this={fileInput}
				accept="image/*,video/mp4"
				class="hidden"
				onchange={handleAvatarPick}
				type="file"
			/>
		</div>

		<div class="flex flex-1 flex-col gap-1.5">
			<Label for="char-name">Name</Label>
			<Input id="char-name" bind:value={name} placeholder="e.g. Lara Lightland" />

			{#if avatarUrl}
				<Button
					class="mt-1 w-fit"
					onclick={() => fileInput?.click()}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Upload class="h-3.5 w-3.5" />
					Replace avatar
				</Button>
			{/if}

			<p class="text-xs text-muted-foreground">
				Static image, animated GIF, or a short MP4 loop -- all supported.
			</p>
		</div>
	</div>

	<div class="grid gap-1.5">
		<Label for="char-gender">Gender</Label>
		<Input id="char-gender" bind:value={gender} placeholder="e.g. female, male, non-binary..." />
	</div>

	<div class="grid gap-1.5">
		<Label for="char-description">
			{editingUserPersona ? 'Who this persona is' : 'Appearance & background'}
		</Label>
		<Textarea
			id="char-description"
			bind:value={description}
			placeholder="What they look like, their history, world, role..."
			rows={3}
		/>
	</div>

	<div class="grid gap-1.5">
		<Label for="char-personality">Personality & behavior</Label>
		<Textarea
			id="char-personality"
			bind:value={personality}
			placeholder="How they talk, react, and act. This is what actually steers roleplay."
			rows={4}
		/>
	</div>

	{#if !editingUserPersona}
		<div class="grid gap-1.5">
			<Label for="char-first-message">First message (optional greeting)</Label>
			<Textarea
				id="char-first-message"
				bind:value={firstMessage}
				placeholder="What they say to open the conversation, in character"
				rows={2}
			/>
		</div>
	{/if}

	<div class="grid gap-1.5">
		<Label for="char-tags">Tags</Label>
		<Input id="char-tags" bind:value={tagsText} placeholder="anime, fantasy, mentor..." />
	</div>

	{#if !editingUserPersona}
		<div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
			<p class="flex items-center gap-1.5 text-sm font-medium">
				<Sparkles class="h-3.5 w-3.5" />
				Let the AI help write this
			</p>

			<div class="flex flex-wrap gap-2">
				<Button onclick={describeFromPortrait} size="sm" type="button" variant="secondary">
					Describe from portrait (vision)
				</Button>
				<Button onclick={researchCharacter} size="sm" type="button" variant="secondary">
					Research this character (web)
				</Button>
			</div>

			<p class="text-xs text-muted-foreground">
				Opens a new chat with a ready-made prompt (and the portrait, for the vision option) using
				your currently selected model. Send it, then paste the reply below.
			</p>

			<Textarea bind:value={assistReply} placeholder="Paste the AI's reply here..." rows={3} />

			<Button
				class="w-fit"
				disabled={!assistReply.trim()}
				onclick={autofillFromReply}
				size="sm"
				type="button"
				variant="outline"
			>
				Fill fields from this reply
			</Button>
		</div>
	{/if}

	<div class="flex items-center justify-between pt-2">
		{#if onDelete}
			<Button onclick={onDelete} size="sm" type="button" variant="ghost">
				<Trash2 class="h-3.5 w-3.5" />
				Delete
			</Button>
		{:else}
			<span></span>
		{/if}

		<div class="flex gap-2">
			<Button onclick={onCancel} type="button" variant="ghost">Cancel</Button>
			<Button type="submit">Save</Button>
		</div>
	</div>
</form>
