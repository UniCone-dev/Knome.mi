<script lang="ts">
	import { RefreshCw, Search, Settings as SettingsIcon } from '@lucide/svelte';
	import { experienceStore } from '$lib/stores/experience.svelte';
	import {
		SettingsChatAppearanceTab,
		SettingsChatDesktopSidebar,
		SettingsChatFields,
		SettingsChatImportExportTab,
		SettingsChatMobileHeader,
		SettingsChatProfileTab,
		SettingsChatToolsTab,
		SettingsFooter
	} from '$lib/components/app/settings';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		NUMERIC_FIELDS,
		POSITIVE_INTEGER_FIELDS,
		SETTINGS_CHAT_SECTIONS,
		SETTINGS_SECTION_SLUGS
	} from '$lib/constants';
	import { ColorMode } from '$lib/enums/ui.enums';
	import { modelsStore, serverStore, settingsStore } from '$lib/stores';
	import type { SettingsSection, SettingsSectionTitle } from '$lib/types';
	import { applyColorMode } from '$lib/stores/settings/index.svelte';
	import { CUSTOM_THEME_TEMPLATE } from '$lib/constants/custom-theme-template';
	import { fade } from 'svelte/transition';
	interface Props {
		initialSection?: string;
		onSectionChange?: (section: SettingsSectionTitle) => void;
		onClose?: () => void;
	}

	let { initialSection, onClose, onSectionChange }: Props = $props();

	let activeSlug = $derived(initialSection ?? 'general');

	const visibleSections = $derived(
		SETTINGS_CHAT_SECTIONS.filter((s) => experienceStore.allowSection(s.slug))
	);

	function handleSectionChange(section: SettingsSectionTitle) {
		const found = SETTINGS_CHAT_SECTIONS.find((s) => s.title === section);

		if (found) {
			activeSlug = found.slug;
		}

		onSectionChange?.(section);
	}

	let currentSection = $derived.by(() => {
		const sec =
			visibleSections.find((section) => section.slug === activeSlug) || visibleSections[0];

		return sec.fields
			? { ...sec, fields: sec.fields.filter((f) => experienceStore.allowField(f)) }
			: sec;
	});

	let localConfig: SettingsConfigType = $state({ ...settingsStore.config });

	let searchQuery = $state('');

	let searchResults = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();

		if (!query) return [];

		return visibleSections.flatMap((section) =>
			(section.fields ?? []).filter(
				(field) =>
					experienceStore.allowField(field) &&
					(field.label.toLowerCase().includes(query) ||
					(field.help ?? '').toLowerCase().includes(query))
			)
		);
	});

	let mobileHeader: { updateCarousel: () => void } | undefined;

	let fetchInitiated = false;

	$effect(() => {
		if (serverStore.isRouterMode && currentSection.fields?.length && !fetchInitiated) {
			fetchInitiated = true;

			void modelsStore
				.fetch()
				.then(() => modelsStore.fetchRouterModels())
				.then(() => modelsStore.props.fetchModalitiesForLoadedModels())
				.then(() => modelsStore.ensureFirstModelSelected());
		}
	});

	function handleThemeChange(newTheme: string) {
		localConfig.theme = newTheme;

		// choosing Custom for the first time: fill the editor with the documented starter CSS
		if (newTheme === ColorMode.CUSTOM && !String(localConfig.customCss ?? '').trim()) {
			localConfig.customCss = CUSTOM_THEME_TEMPLATE;
		}

		applyColorMode(newTheme as ColorMode);
	}

	function handleConfigChange(key: string, value: string | boolean) {
		localConfig[key] = value;
	}

	function handleReset() {
		localConfig = { ...settingsStore.config };
		applyColorMode(localConfig.theme as ColorMode);
		mobileHeader?.updateCarousel();
	}

	function handleSave() {
		if (
			localConfig.customJson &&
			typeof localConfig.customJson === 'string' &&
			localConfig.customJson.trim()
		) {
			try {
				JSON.parse(localConfig.customJson);
			} catch (error) {
				alert('Invalid JSON in custom parameters. Please check the format and try again.');
				console.error(error);

				return;
			}
		}

		const processedConfig = { ...localConfig };

		for (const field of NUMERIC_FIELDS) {
			if (processedConfig[field] !== undefined && processedConfig[field] !== '') {
				const numValue = Number(processedConfig[field]);

				if (!isNaN(numValue)) {
					if ((POSITIVE_INTEGER_FIELDS as readonly string[]).includes(field)) {
						const entryByMinMax = SETTINGS_CHAT_SECTIONS.flatMap(
							(section) => section.fields ?? []
						).find((entry) => entry.key === field);
						const lo = entryByMinMax?.min ?? 1;
						const hi = entryByMinMax?.max ?? Number.POSITIVE_INFINITY;

						processedConfig[field] = Math.max(lo, Math.min(hi, Math.round(numValue)));
					} else {
						processedConfig[field] = numValue;
					}
				} else {
					alert(`Invalid numeric value for ${field}. Please enter a valid number.`);

					return;
				}
			}
		}

		settingsStore.updateMultipleConfig(processedConfig);
		onClose?.();
	}

	export function reset() {
		localConfig = { ...settingsStore.config };
	}
</script>

<div
	in:fade={{ duration: 150 }}
	class="settings-shell flex h-full min-h-0 w-full flex-col md:flex-row"
>
	<aside
		class="settings-aside hidden w-64 shrink-0 flex-col gap-4 border-r border-border/60 bg-muted/30 p-4 md:flex"
	>
		<div class="flex items-center gap-2 px-2 pt-1 text-base font-semibold tracking-tight">
			<SettingsIcon class="h-5 w-5 text-primary" />

			<span>Settings</span>
		</div>

		<div class="relative">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>

			<Input
				bind:value={searchQuery}
				class="h-9 rounded-xl border-transparent bg-background pl-9 shadow-none"
				placeholder="Search settings"
			/>
		</div>

		<SettingsChatDesktopSidebar
			isActive={(section: SettingsSection) => section.slug === activeSlug}
			onSectionChange={handleSectionChange}
			sections={visibleSections}
		/>
	</aside>

	<div class="flex shrink-0 flex-col md:hidden">
		<div class="px-4 pt-4 pr-14">
			<div class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>

				<Input bind:value={searchQuery} class="rounded-xl pl-9" placeholder="Search settings" />
			</div>
		</div>

		<SettingsChatMobileHeader
			bind:this={mobileHeader}
			isActive={(section: SettingsSection) => section.slug === activeSlug}
			onSectionChange={handleSectionChange}
			sections={visibleSections}
		/>
	</div>

	<main class="flex min-h-0 min-w-0 flex-1 flex-col">
		<div class="settings-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
			<div class="mx-auto w-full max-w-2xl">
				<h2 class="settings-title mb-5 text-xl font-semibold tracking-tight">
					{searchQuery.trim() ? 'Search results' : currentSection.title}
				</h2>

				{#if searchQuery.trim()}
					{#if searchResults.length}
						<div class="settings-card">
							<SettingsChatFields
								fields={searchResults}
								{localConfig}
								onConfigChange={handleConfigChange}
								onThemeChange={handleThemeChange}
							/>
						</div>
					{:else}
						<p class="py-8 text-center text-sm text-muted-foreground">
							No settings match "{searchQuery}"
						</p>
					{/if}
				{:else if currentSection.slug === SETTINGS_SECTION_SLUGS.TOOLS}
					<SettingsChatToolsTab />
				{:else if currentSection.slug === SETTINGS_SECTION_SLUGS.APPEARANCE}
					<SettingsChatAppearanceTab />
				{:else if currentSection.slug === SETTINGS_SECTION_SLUGS.PROFILE}
					<SettingsChatProfileTab />
				{:else if currentSection.slug === SETTINGS_SECTION_SLUGS.IMPORT_EXPORT}
					<SettingsChatImportExportTab />
				{:else if currentSection.fields}
					<div class="settings-card">
						<SettingsChatFields
							fields={currentSection.fields}
							{localConfig}
							onConfigChange={handleConfigChange}
							onThemeChange={handleThemeChange}
						/>
					</div>

					{#if currentSection.slug === SETTINGS_SECTION_SLUGS.GENERAL}
						<div class="mt-4 flex justify-end">
							<Button onclick={() => window.location.reload()} size="sm" variant="outline">
								<RefreshCw class="h-3 w-3" />
								Reload app
							</Button>
						</div>
					{/if}
				{/if}

				<p class="mt-8 text-xs text-muted-foreground">
					Settings are saved in this browser's localStorage.
				</p>
			</div>
		</div>

		<SettingsFooter onReset={handleReset} onSave={handleSave} />
	</main>
</div>
