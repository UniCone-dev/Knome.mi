<script lang="ts">
	import { ICON_CLASS_DEFAULT } from '$lib/constants';
	import type { SettingsSection, SettingsSectionTitle } from '$lib/types';

	interface Props {
		sections: SettingsSection[];
		isActive: (section: SettingsSection) => boolean;
		onSectionChange?: (section: SettingsSectionTitle) => void;
	}

	let { isActive, onSectionChange, sections }: Props = $props();
</script>

<nav class="settings-nav-list flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
	{#each sections as section (section.title)}
		<button
			class="settings-nav-item group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 {isActive(
				section
			)
				? 'bg-primary/10 font-medium text-foreground'
				: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}"
			aria-current={isActive(section) ? 'page' : undefined}
			onclick={() => onSectionChange?.(section.title)}
		>
			<section.icon
				class="{ICON_CLASS_DEFAULT} shrink-0 transition-colors {isActive(section)
					? 'text-primary'
					: ''}"
			/>

			<span class="truncate">{section.title}</span>
		</button>
	{/each}
</nav>
