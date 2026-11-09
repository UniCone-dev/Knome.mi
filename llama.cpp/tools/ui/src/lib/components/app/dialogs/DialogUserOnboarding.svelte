<script lang="ts">
	import { Sparkles, Upload, User } from '@lucide/svelte';
	import { PROFILE_AVATAR_MAX_DIMENSION, PROFILE_CATEGORY_OPTIONS, SETTINGS_KEYS } from '$lib/constants';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { settingsStore } from '$lib/stores';

	interface Props {
		open: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { onOpenChange, open = $bindable() }: Props = $props();

	type Step = 'name' | 'avatar' | 'description' | 'category' | 'ai-nickname';
	const STEPS: Step[] = ['name', 'avatar', 'description', 'category', 'ai-nickname'];

	let stepIndex = $state(0);
	let step = $derived(STEPS[stepIndex]);

	// Draft values -- only written to settingsStore on final completion (or
	// per-step skip), never partially, so closing mid-flow loses nothing set.
	let name = $state('');
	let avatarDataUrl = $state('');
	let description = $state('');
	let category = $state('');
	let categoryDetail = $state('');
	let aiNickname = $state('');

	let fileInputRef: HTMLInputElement | undefined = $state();
	let avatarError = $state('');

	const selectedCategoryOption = $derived(
		PROFILE_CATEGORY_OPTIONS.find((c) => c.value === category)
	);

	function resetDraft() {
		stepIndex = 0;
		name = '';
		avatarDataUrl = '';
		description = '';
		category = '';
		categoryDetail = '';
		aiNickname = '';
		avatarError = '';
	}

	function seedDraftFromSettings() {
		const c = settingsStore.config;

		name = (c[SETTINGS_KEYS.PROFILE_NAME] as string) ?? '';
		avatarDataUrl = (c[SETTINGS_KEYS.PROFILE_AVATAR] as string) ?? '';
		description = (c[SETTINGS_KEYS.PROFILE_DESCRIPTION] as string) ?? '';
		category = (c[SETTINGS_KEYS.PROFILE_CATEGORY] as string) ?? '';
		categoryDetail = (c[SETTINGS_KEYS.PROFILE_CATEGORY_DETAIL] as string) ?? '';
		aiNickname = (c[SETTINGS_KEYS.PROFILE_AI_NICKNAME] as string) ?? '';
	}

	// Reopening (e.g. "Edit profile" from Settings) shows current values
	// instead of a blank wizard; a genuinely first-time open is blank anyway
	// since settings default to ''.
	let wasOpen = false;

	$effect(() => {
		if (open && !wasOpen) {
			seedDraftFromSettings();
			stepIndex = 0;
		}

		wasOpen = open;
	});

	function handleAvatarFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			avatarError = 'Please choose an image file.';
			return;
		}

		avatarError = '';

		const reader = new FileReader();

		reader.onload = () => {
			const img = new Image();

			img.onload = () => {
				// Downscale to a small square so it doesn't bloat localStorage.
				const size = PROFILE_AVATAR_MAX_DIMENSION;
				const canvas = document.createElement('canvas');

				canvas.width = size;
				canvas.height = size;

				const ctx = canvas.getContext('2d');

				if (!ctx) return;

				const scale = Math.max(size / img.width, size / img.height);
				const drawWidth = img.width * scale;
				const drawHeight = img.height * scale;

				ctx.drawImage(
					img,
					(size - drawWidth) / 2,
					(size - drawHeight) / 2,
					drawWidth,
					drawHeight
				);

				avatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
			};

			img.src = reader.result as string;
		};

		reader.readAsDataURL(file);
	}

	function goNext() {
		if (stepIndex < STEPS.length - 1) {
			stepIndex += 1;
		} else {
			complete();
		}
	}

	function goBack() {
		if (stepIndex > 0) stepIndex -= 1;
	}

	function skipStep() {
		goNext();
	}

	function skipAll() {
		settingsStore.updateConfig(SETTINGS_KEYS.PROFILE_ONBOARDING_DONE, true);
		handleOpenChange(false);
	}

	function complete() {
		settingsStore.updateMultipleConfig({
			[SETTINGS_KEYS.PROFILE_NAME]: name.trim(),
			[SETTINGS_KEYS.PROFILE_AVATAR]: avatarDataUrl,
			[SETTINGS_KEYS.PROFILE_DESCRIPTION]: description.trim(),
			[SETTINGS_KEYS.PROFILE_CATEGORY]: category,
			[SETTINGS_KEYS.PROFILE_CATEGORY_DETAIL]: categoryDetail.trim(),
			[SETTINGS_KEYS.PROFILE_AI_NICKNAME]: aiNickname.trim(),
			[SETTINGS_KEYS.PROFILE_ONBOARDING_DONE]: true
		});
		handleOpenChange(false);
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;

		if (!newOpen) {
			// Treat closing (X / overlay click) the same as "skip all" so it
			// never re-prompts every launch -- but only mark done, don't wipe
			// whatever the user already typed if they reopen from Settings.
			if (!settingsStore.config[SETTINGS_KEYS.PROFILE_ONBOARDING_DONE]) {
				settingsStore.updateConfig(SETTINGS_KEYS.PROFILE_ONBOARDING_DONE, true);
			}

			resetDraft();
		}

		onOpenChange?.(newOpen);
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-md" showCloseButton>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-primary" />
				Set up your profile
			</Dialog.Title>

			<Dialog.Description>
				Optional -- everything here stays on this device. Skip any step, or skip
				all of it.
			</Dialog.Description>
		</Dialog.Header>

		<div class="min-h-48 space-y-4 py-2">
			{#if step === 'name'}
				<div class="space-y-2">
					<Label for="profile-name">What should we call you?</Label>
					<Input
						id="profile-name"
						autofocus
						bind:value={name}
						onkeydown={(e) => e.key === 'Enter' && goNext()}
						placeholder="e.g. Alex"
					/>
				</div>
			{:else if step === 'avatar'}
				<div class="flex flex-col items-center gap-3">
					<button
						class="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-primary"
						onclick={() => fileInputRef?.click()}
						type="button"
					>
						{#if avatarDataUrl}
							<img alt="Your avatar" class="h-full w-full object-cover" src={avatarDataUrl} />
						{:else}
							<User class="h-8 w-8 text-muted-foreground" />
						{/if}

						<div
							class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
						>
							<Upload class="h-5 w-5 text-white" />
						</div>
					</button>

					<input
						bind:this={fileInputRef}
						accept="image/*"
						class="hidden"
						onchange={handleAvatarFile}
						type="file"
					/>

					<p class="text-sm text-muted-foreground">Add a profile picture (optional)</p>

					{#if avatarError}
						<p class="text-sm text-destructive">{avatarError}</p>
					{/if}
				</div>
			{:else if step === 'description'}
				<div class="space-y-2">
					<Label for="profile-description">A little about you</Label>
					<Textarea
						id="profile-description"
						bind:value={description}
						placeholder='e.g. "I prefer concise answers with code examples."'
						rows={4}
					/>
				</div>
			{:else if step === 'category'}
				<div class="space-y-3">
					<Label>What do you do?</Label>

					<div class="grid grid-cols-2 gap-2">
						{#each PROFILE_CATEGORY_OPTIONS as option (option.value)}
							<button
								class="rounded-lg border px-3 py-2 text-left text-sm transition-colors {category ===
								option.value
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border hover:bg-accent'}"
								onclick={() => (category = category === option.value ? '' : option.value)}
								type="button"
							>
								{option.label}
							</button>
						{/each}
					</div>

					{#if selectedCategoryOption}
						<Input
							bind:value={categoryDetail}
							placeholder={selectedCategoryOption.followUpPlaceholder}
						/>
					{/if}
				</div>
			{:else if step === 'ai-nickname'}
				<div class="space-y-2">
					<Label for="profile-ai-nickname">What should you call the AI?</Label>
					<Input
						id="profile-ai-nickname"
						bind:value={aiNickname}
						onkeydown={(e) => e.key === 'Enter' && goNext()}
						placeholder="e.g. Astro"
					/>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-between border-t border-border/30 pt-4">
			<Button onclick={skipAll} size="sm" variant="ghost">Skip setup</Button>

			<div class="flex items-center gap-2">
				{#if stepIndex > 0}
					<Button onclick={goBack} size="sm" variant="outline">Back</Button>
				{/if}

				<Button onclick={skipStep} size="sm" variant="outline">Skip</Button>

				<Button onclick={goNext} size="sm">
					{stepIndex === STEPS.length - 1 ? 'Finish' : 'Continue'}
				</Button>
			</div>
		</div>

		<div class="flex justify-center gap-1.5 pt-1">
			{#each STEPS as s, i (s)}
				<div
					class="h-1.5 w-1.5 rounded-full {i === stepIndex ? 'bg-primary' : 'bg-border'}"
				></div>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
