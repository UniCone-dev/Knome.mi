/**
 * ctxSizeStore - the context size (in tokens) each model is loaded with.
 *
 * '' = "Default" (whatever ./Knome-start.sh / install.sh settings say), 'auto' = let llama.cpp fit the
 * context to the free memory, otherwise a token count such as '8192'. Remembered per browser and sent
 * with every load so the choice sticks until the user changes it. If a model fails to load because the
 * memory is too small, pick a smaller size (or Auto) in Models > Context and press Load again.
 */
import { browser } from '$app/environment';

const KEY = 'Knome.ctxsize';

export const CTX_CHOICES: { value: string; label: string }[] = [
	{ value: '', label: 'Default (from install settings)' },
	{ value: 'auto', label: 'Auto (fit to free memory)' },
	{ value: '4096', label: '4K' },
	{ value: '8192', label: '8K' },
	{ value: '16384', label: '16K' },
	{ value: '32768', label: '32K' },
	{ value: '65536', label: '64K' },
	{ value: '131072', label: '128K' },
	{ value: '262144', label: '256K' }
];

function read(): Record<string, string> {
	if (!browser) return {};

	try {
		const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');

		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}

class CtxSizeStore {
	choices = $state<Record<string, string>>(read());

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

	/** value for the server: undefined = keep the server default, 0 = auto, N = tokens */
	forServer(modelId: string): number | undefined {
		const c = this.get(modelId);

		if (!c) return undefined;
		if (c === 'auto') return 0;

		const n = Number(c);

		return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
	}
}

export const ctxSizeStore = new CtxSizeStore();
