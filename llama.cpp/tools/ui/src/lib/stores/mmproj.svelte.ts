/**
 * mmprojStore - which vision projector (mmproj) each model is loaded with.
 *
 * '' = automatic (whatever the server finds next to the model), 'none' = no vision,
 * anything else = a .gguf path offered by the server. Remembered per browser and sent
 * with every load so the choice sticks until the user changes it.
 */
import { browser } from '$app/environment';

const KEY = 'Knome.mmproj';

function read(): Record<string, string> {
	if (!browser) return {};

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');

		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}

class MmprojStore {
	choices = $state<Record<string, string>>(read());
	/** model id the vision dialog is open for, '' = closed */
	dialogModel = $state('');

	get(modelId: string): string {
		return this.choices[modelId] ?? '';
	}

	set(modelId: string, value: string): void {
		const next = { ...this.choices };

		if (value) next[modelId] = value;
		else delete next[modelId];

		this.choices = next;

		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {
			/* storage unavailable */
		}
	}

	open(modelId: string): void {
		this.dialogModel = modelId;
	}
}

export const mmprojStore = new MmprojStore();
