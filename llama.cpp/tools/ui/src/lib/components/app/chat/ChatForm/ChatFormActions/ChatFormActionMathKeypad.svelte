<script lang="ts">
	import {
		MATH_KEYPAD_SECTIONS,
		rootGlyph,
		toSubscript,
		toSuperscript
	} from '$lib/constants';

	interface Props {
		onInsert: (text: string) => void;
	}

	let { onInsert }: Props = $props();

	let powerText = $state('');
	let rootText = $state('');
	let subText = $state('');

	const powerPreview = $derived(powerText.trim() ? toSuperscript(powerText) : null);
	const rootPreview = $derived(rootText.trim() ? rootGlyph(rootText) : null);
	const subPreview = $derived(subText.trim() ? toSubscript(subText) : null);

	function insertCustom(preview: string | null, clear: () => void) {
		if (!preview) return;

		onInsert(preview);
		clear();
	}

	function onEnter(e: KeyboardEvent, run: () => void) {
		if (e.key !== 'Enter') return;

		e.preventDefault();
		run();
	}

	const inputClass =
		'h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus:border-primary';
	const goClass =
		'h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40';
</script>

{#snippet custom(
	title: string,
	hint: string,
	value: string,
	preview: string | null,
	setValue: (v: string) => void,
	run: () => void
)}
	<div class="space-y-1">
		<p class="px-1 text-[11px] text-muted-foreground">{title}</p>

		<div class="flex items-center gap-1.5">
			<input
				autocomplete="off"
				class={inputClass}
				oninput={(e) => setValue((e.target as HTMLInputElement).value)}
				onkeydown={(e) => onEnter(e, run)}
				placeholder={hint}
				{value}
			/>

			<span
				class="w-16 flex-shrink-0 truncate text-center text-sm {value.trim() && !preview
					? 'text-destructive'
					: ''}"
			>
				{value.trim() ? (preview ?? '?') : ''}
			</span>

			<button class={goClass} disabled={!preview} onclick={run} type="button">Add</button>
		</div>
	</div>
{/snippet}

<div class="max-h-[26rem] w-80 space-y-4 overflow-y-auto p-3">
	<!-- Any-size power / root / subscript: type the number, press Enter -->
	<div class="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-2">
		{@render custom(
			'Any power: 1000, -3, n+1 ...',
			'e.g. 1000',
			powerText,
			powerPreview,
			(v) => (powerText = v),
			() => insertCustom(powerPreview, () => (powerText = ''))
		)}

		{@render custom(
			'Any root: 2, 7, 1000 ...',
			'e.g. 12',
			rootText,
			rootPreview,
			(v) => (rootText = v),
			() => insertCustom(rootPreview, () => (rootText = ''))
		)}

		{@render custom(
			'Any subscript: 12, n, i+1 ...',
			'e.g. 12',
			subText,
			subPreview,
			(v) => (subText = v),
			() => insertCustom(subPreview, () => (subText = ''))
		)}
	</div>

	{#each MATH_KEYPAD_SECTIONS as section (section.title)}
		<div class="space-y-1.5">
			<p class="px-1 text-xs font-medium text-muted-foreground">{section.title}</p>

			<div class="grid grid-cols-7 gap-1">
				{#each section.tokens as token (token.insert)}
					<button
						class="flex h-9 items-center justify-center rounded-md border border-border/50 text-sm hover:bg-accent hover:text-accent-foreground"
						onclick={() => onInsert(token.insert)}
						title={token.label}
						type="button"
					>
						{token.display ?? token.insert}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
