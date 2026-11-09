<script lang="ts">
	import ExperiencePicker from '$lib/components/app/misc/ExperiencePicker.svelte';
	import SettingsChatMemorySection from './SettingsChatMemorySection.svelte';
	import SettingsChatImageGenSection from './SettingsChatImageGenSection.svelte';
	import { Pencil, Trash2, User } from '@lucide/svelte';
	import { DialogUserOnboarding } from '$lib/components/app';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		PROFILE_CATEGORY_OPTIONS,
		PROFILE_DELETE_CONFIRM_PHRASE,
		SETTINGS_KEYS
	} from '$lib/constants';
	import { charactersStore, settingsStore } from '$lib/stores';
	import { Switch } from '$lib/components/ui/switch';
	import { BrainCircuit } from '@lucide/svelte';

	let showEditDialog = $state(false);
	let showDeleteConfirm = $state(false);
	let deleteConfirmInput = $state('');

	let profileName = $derived((settingsStore.config[SETTINGS_KEYS.PROFILE_NAME] as string) || '');
	let profileAvatar = $derived(
		(settingsStore.config[SETTINGS_KEYS.PROFILE_AVATAR] as string) || ''
	);
	let profileDescription = $derived(
		(settingsStore.config[SETTINGS_KEYS.PROFILE_DESCRIPTION] as string) || ''
	);
	let profileCategory = $derived(
		(settingsStore.config[SETTINGS_KEYS.PROFILE_CATEGORY] as string) || ''
	);
	let profileCategoryLabel = $derived(
		PROFILE_CATEGORY_OPTIONS.find((c) => c.value === profileCategory)?.label ?? ''
	);
	let profileAiNickname = $derived(
		(settingsStore.config[SETTINGS_KEYS.PROFILE_AI_NICKNAME] as string) || ''
	);
	let hasProfile = $derived(
		Boolean(profileName || profileDescription || profileCategory || profileAiNickname)
	);
	let showStartScreen = $derived(
		Boolean(settingsStore.config[SETTINGS_KEYS.SHOW_START_SCREEN] ?? true)
	);

	let canDelete = $derived(
		deleteConfirmInput.trim().toLowerCase() === PROFILE_DELETE_CONFIRM_PHRASE
	);

	let deepMind = $derived(Boolean(settingsStore.config[SETTINGS_KEYS.DEEPMIND_MODE] ?? false));
	let activeCharacterName = $derived(charactersStore.activeCharacter?.name ?? '');

	function toggleDeepMind(checked: boolean) {
		settingsStore.updateConfig(SETTINGS_KEYS.DEEPMIND_MODE, checked);
	}

	function toggleStartScreen(checked: boolean) {
		settingsStore.updateConfig(SETTINGS_KEYS.SHOW_START_SCREEN, checked);
	}

	let welcomeScreen = $derived(Boolean(settingsStore.config[SETTINGS_KEYS.WELCOME_SCREEN] ?? true));

	let welcomeStyle = $derived(
		(settingsStore.config[SETTINGS_KEYS.WELCOME_STYLE] as string) === 'classic'
			? 'classic'
			: 'modern'
	);

	function setWelcomeStyle(style: 'modern' | 'classic') {
		settingsStore.updateConfig(SETTINGS_KEYS.WELCOME_STYLE, style);
	}

	function toggleWelcomeScreen(checked: boolean) {
		settingsStore.updateConfig(SETTINGS_KEYS.WELCOME_SCREEN, checked);
	}

	function openDeleteConfirm() {
		deleteConfirmInput = '';
		showDeleteConfirm = true;
	}

	function confirmDelete() {
		if (!canDelete) return;

		settingsStore.updateMultipleConfig({
			[SETTINGS_KEYS.PROFILE_NAME]: '',
			[SETTINGS_KEYS.PROFILE_AVATAR]: '',
			[SETTINGS_KEYS.PROFILE_DESCRIPTION]: '',
			[SETTINGS_KEYS.PROFILE_CATEGORY]: '',
			[SETTINGS_KEYS.PROFILE_CATEGORY_DETAIL]: '',
			[SETTINGS_KEYS.PROFILE_AI_NICKNAME]: '',
			[SETTINGS_KEYS.PROFILE_ONBOARDING_DONE]: false
		});

		showDeleteConfirm = false;
		deleteConfirmInput = '';
	}
</script>

<div class="space-y-6">
	<p class="text-sm text-muted-foreground">
		Fully private -- stored only in this browser. Never sent anywhere except into your own
		conversations, if you choose.
	</p>

	<div class="flex items-center gap-4 rounded-lg border border-border/50 p-4">
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted"
		>
			{#if profileAvatar}
				<img alt="Your avatar" class="h-full w-full object-cover" src={profileAvatar} />
			{:else}
				<User class="h-6 w-6 text-muted-foreground" />
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			{#if hasProfile}
				<p class="truncate font-medium">{profileName || 'Unnamed'}</p>

				<p class="truncate text-sm text-muted-foreground">
					{[profileCategoryLabel, profileAiNickname && `calls you "${profileAiNickname}"`]
						.filter(Boolean)
						.join(' · ') || 'No details added'}
				</p>
			{:else}
				<p class="font-medium">No profile set up yet</p>
				<p class="text-sm text-muted-foreground">Add your name so the AI knows who you are</p>
			{/if}
		</div>

		<Button onclick={() => (showEditDialog = true)} size="sm" variant="outline">
			<Pencil class="h-3.5 w-3.5" />
			{hasProfile ? 'Edit' : 'Set up'}
		</Button>
	</div>

	{#if profileDescription}
		<div class="space-y-1.5">
			<Label>Description</Label>
			<p class="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
				{profileDescription}
			</p>
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<Checkbox
			checked={showStartScreen}
			id="show-start-screen"
			onCheckedChange={(checked) => toggleStartScreen(Boolean(checked))}
		/>
		<Label class="text-sm font-normal" for="show-start-screen">
			Show "Start Conversation" welcome screen for new chats
		</Label>
	</div>

	<div class="space-y-1">
		<div class="flex items-center gap-2">
			<Checkbox
				checked={welcomeScreen}
				id="welcome-screen"
				onCheckedChange={(checked) => toggleWelcomeScreen(Boolean(checked))}
			/>
			<Label class="text-sm font-normal" for="welcome-screen">Welcome screen</Label>
		</div>
		<p class="pl-6 text-xs text-muted-foreground">
			Shown when you open Knome (once per browser session). A button takes you to the start page.
		</p>

		{#if welcomeScreen}
			<div class="flex gap-2 pt-2 pl-6">
				{#each [{ value: 'modern', label: 'Modern', note: 'Recommended' }, { value: 'classic', label: 'Classic', note: 'Animated hero' }] as opt (opt.value)}
					<button
						class="flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors {welcomeStyle ===
						opt.value
							? 'border-primary bg-primary/10'
							: 'border-border hover:bg-muted/60'}"
						onclick={() => setWelcomeStyle(opt.value as 'modern' | 'classic')}
						type="button"
					>
						<span class="block font-medium">{opt.label}</span>
						<span class="block text-xs text-muted-foreground">{opt.note}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="space-y-3 rounded-xl border border-border/60 p-4">
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-start gap-3">
				<BrainCircuit class="mt-0.5 h-5 w-5 shrink-0 text-primary" />

				<div class="space-y-1">
					<Label class="text-sm font-medium" for="deepmind-mode">AI profile: DeepMind mode</Label>

					<p class="text-xs text-muted-foreground">
						The AI becomes your active character instead of playing it: no roleplay, no scene
						narration, no prompt to see or wait for. The identity is applied automatically to every
						chat and model, and kept in the server's cache so replies do not slow down. Off by
						default.
					</p>

					<p class="text-xs text-muted-foreground">
						Active character:
						<span class="font-medium text-foreground">
							{activeCharacterName || 'none (pick one in Characters)'}
						</span>
					</p>
				</div>
			</div>

			<Switch checked={deepMind} id="deepmind-mode" onCheckedChange={toggleDeepMind} />
		</div>

		<p class="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
			DeepMind works in both layouts. In the Messenger layout each contact becomes the AI's identity
			and it texts like a person on a phone: short, natural messages.
		</p>
	</div>

	<div class="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
		<div>
			<h3 class="text-base font-semibold">Experience</h3>
			<p class="text-sm text-muted-foreground">
				Choose how much of Knome you see. Switching only hides or shows options; your values stay.
			</p>
		</div>

		<ExperiencePicker />
	</div>

	<SettingsChatMemorySection />

	<SettingsChatImageGenSection />

	{#if hasProfile}
		<div class="border-t border-border/30 pt-4">
			{#if !showDeleteConfirm}
				<Button onclick={openDeleteConfirm} size="sm" variant="destructive">
					<Trash2 class="h-3.5 w-3.5" />
					Delete my profile
				</Button>
			{:else}
				<div class="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
					<p class="text-sm">
						This permanently deletes your name, avatar, description and preferences from this
						browser. Type <code class="rounded bg-destructive/10 px-1 py-0.5"
							>{PROFILE_DELETE_CONFIRM_PHRASE}</code
						>
						to confirm.
					</p>

					<Input bind:value={deleteConfirmInput} placeholder={PROFILE_DELETE_CONFIRM_PHRASE} />

					<div class="flex justify-end gap-2">
						<Button onclick={() => (showDeleteConfirm = false)} size="sm" variant="ghost">
							Cancel
						</Button>
						<Button disabled={!canDelete} onclick={confirmDelete} size="sm" variant="destructive">
							Delete permanently
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<DialogUserOnboarding bind:open={showEditDialog} />
