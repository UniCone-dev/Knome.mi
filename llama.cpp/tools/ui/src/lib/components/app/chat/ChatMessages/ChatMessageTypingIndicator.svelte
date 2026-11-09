<script lang="ts">
	import { Card } from '$lib/components/ui/card';
	import { charactersStore } from '$lib/stores';
</script>

<!-- "Typing only" display: no reasoning or tool details, just that the other side is busy. -->
{#snippet dots()}
	<span aria-live="polite" class="inline-flex items-center gap-2 text-xs text-muted-foreground">
		<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
		typing
	</span>
{/snippet}

{#if charactersStore.showAiBubble}
	<Card
		class="chat-message-ai-bubble w-fit rounded-[1.125rem] border-none bg-muted px-3.75 py-2"
		style="{charactersStore.aiBubbleColor
			? `background-color: ${charactersStore.aiBubbleColor};`
			: ''} {charactersStore.aiTextColor ? `color: ${charactersStore.aiTextColor};` : ''}"
	>
		{@render dots()}
	</Card>
{:else}
	{@render dots()}
{/if}

<style>
	.typing-dots {
		display: inline-flex;
		gap: 3px;
	}

	.typing-dots span {
		width: 5px;
		height: 5px;
		border-radius: 9999px;
		background: currentColor;
		opacity: 0.4;
		animation: typing-bounce 1.2s infinite ease-in-out;
	}

	.typing-dots span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.typing-dots span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes typing-bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}

		30% {
			transform: translateY(-3px);
			opacity: 1;
		}
	}
</style>
