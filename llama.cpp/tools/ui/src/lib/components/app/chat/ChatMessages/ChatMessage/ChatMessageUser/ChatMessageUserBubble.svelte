<script lang="ts">
	import { ChatAttachmentsList, MarkdownContent, MentionText } from '$lib/components/app';
	import { Card } from '$lib/components/ui/card';
	import { SETTINGS_KEYS } from '$lib/constants';
	import { settingsStore } from '$lib/stores';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { DatabaseMessageExtra } from '$lib/types/database';

	interface Props {
		content: string;
		attachments?: DatabaseMessageExtra[];
		renderMarkdown?: boolean;
		textColorClass?: string;
		cardBgClass?: string;
		maxHeightStyle?: string;
		/** Raw CSS color overrides (e.g. from a color picker) -- take priority over the class-based defaults above when set. */
		bgColor?: string;
		textColor?: string;
	}

	let {
		attachments = [],
		bgColor,
		cardBgClass = 'dark:bg-primary/15',
		content,
		maxHeightStyle = '',
		renderMarkdown = false,
		textColor,
		textColorClass = 'text-foreground'
	}: Props = $props();

	let colorStyle = $derived(
		[bgColor ? `background-color: ${bgColor};` : '', textColor ? `color: ${textColor};` : ''].join(
			' '
		)
	);

	// Long messages fold to a few lines with a "Show more" button (Settings > Display).
	const FOLD_THRESHOLD_PX = 288;
	const FOLD_HEIGHT = '15rem';

	let foldInner: HTMLElement | undefined = $state();
	let tooTall = $state(false);
	let expanded = $state(false);
	let foldEnabled = $derived(
		Boolean(settingsStore.config[SETTINGS_KEYS.COLLAPSE_LONG_MESSAGES] ?? true)
	);
	let folded = $derived(foldEnabled && tooTall && !expanded);

	$effect(() => {
		if (!foldInner) return;

		const observer = new ResizeObserver(() => {
			if (foldInner) tooTall = foldInner.offsetHeight > FOLD_THRESHOLD_PX;
		});

		observer.observe(foldInner);

		return () => observer.disconnect();
	});

	let isMultiline = $state(false);
	let messageElement: HTMLElement | undefined = $state();
	const currentConfig = settingsStore.config;

	$effect(() => {
		if (!messageElement || !content.trim()) return;

		if (content.includes('\n')) {
			isMultiline = true;

			return;
		}

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const element = entry.target as HTMLElement;
				const estimatedSingleLineHeight = 24; // Typical line height for text-md

				isMultiline = element.offsetHeight > estimatedSingleLineHeight * 1.5;
			}
		});

		resizeObserver.observe(messageElement);

		return () => {
			resizeObserver.disconnect();
		};
	});
</script>

{#if attachments && attachments.length > 0}
	<div class="mb-2 max-w-[80%]">
		<ChatAttachmentsList {attachments} imageHeight="h-40" readonly />
	</div>
{/if}

{#if content.trim()}
	<Card
		class="chat-message-user-bubble max-w-[80%] overflow-y-auto rounded-[1.125rem] border-none bg-primary/5 px-3.75 py-1.5 {textColorClass} backdrop-blur-md data-multiline:py-2.5 {cardBgClass}"
		data-multiline={isMultiline ? '' : undefined}
		style="{maxHeightStyle} {colorStyle} overflow-wrap: anywhere; word-break: break-word;"
	>
		<div
			class="relative"
			style:max-height={folded ? FOLD_HEIGHT : undefined}
			style:overflow={folded ? 'hidden' : undefined}
			style:mask-image={folded ? 'linear-gradient(to bottom, #000 62%, transparent)' : undefined}
			style:-webkit-mask-image={folded
				? 'linear-gradient(to bottom, #000 62%, transparent)'
				: undefined}
		>
			<div bind:this={foldInner}>
				{#if renderMarkdown && currentConfig.renderUserContentAsMarkdown}
					<div bind:this={messageElement}>
						<MarkdownContent class="markdown-user-content" {content} />
					</div>
				{:else}
					<span bind:this={messageElement} class="text-md whitespace-pre-wrap"
						><MentionText {content} /></span
					>
				{/if}
			</div>
		</div>

		{#if foldEnabled && tooTall}
			<button
				class="mt-1 -mb-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				onclick={() => (expanded = !expanded)}
				type="button"
			>
				{#if expanded}
					<ChevronUp class="h-3.5 w-3.5" /> Show less
				{:else}
					<ChevronDown class="h-3.5 w-3.5" /> Show more
				{/if}
			</button>
		{/if}
	</Card>
{/if}
