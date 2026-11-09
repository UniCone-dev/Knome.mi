/**
 * experience - how much of Knome is shown: Minimal, Pro or Free (everything).
 *
 * Only hides settings / shortcuts, never changes a stored value, so switching back and
 * forth loses nothing.
 */
import { SETTINGS_KEYS } from '$lib/constants/settings-keys.constants';
import { settingsStore } from '$lib/stores/settings/index.svelte';
import type { SettingsFieldConfig } from '$lib/types';

export type ExperienceLevel = 'minimal' | 'pro' | 'full';

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; title: string; sub: string }[] = [
	{
		value: 'minimal',
		title: 'Clean & Minimal',
		sub: 'The cleanest screen. Only the settings most people ever need.'
	},
	{
		value: 'pro',
		title: 'Pro',
		sub: 'Clean, with the useful options: display, tools, agents, models.'
	},
	{
		value: 'full',
		title: 'Free',
		sub: 'Everything unlocked and in your hands, sampling and developer options too.'
	}
];

const MINIMAL_SECTIONS = ['general', 'appearance', 'display', 'profile', 'import-export'];
const PRO_HIDDEN_SECTIONS = ['sampling-penalties', 'developer'];

class ExperienceStore {
	get level(): ExperienceLevel {
		const v = settingsStore.config[SETTINGS_KEYS.EXPERIENCE_MODE];

		return v === 'minimal' || v === 'pro' ? v : 'full';
	}

	set(level: ExperienceLevel) {
		settingsStore.updateConfig(SETTINGS_KEYS.EXPERIENCE_MODE, level);
	}

	allowSection(slug: string): boolean {
		if (this.level === 'full') return true;
		if (this.level === 'pro') return !PRO_HIDDEN_SECTIONS.includes(slug);

		return MINIMAL_SECTIONS.includes(slug);
	}

	/** field-level filter inside the generic (registry driven) settings pages */
	allowField(field: SettingsFieldConfig): boolean {
		if (this.level === 'full') return true;
		if (field.isExperimental) return false;
		if (this.level === 'pro') return true;

		return field.recommended === true || field.minimal === true;
	}
}

export const experienceStore = new ExperienceStore();
