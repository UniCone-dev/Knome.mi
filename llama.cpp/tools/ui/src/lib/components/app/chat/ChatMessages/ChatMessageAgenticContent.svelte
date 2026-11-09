<script lang="ts">
	import ChatMessageToolCallBlock from './ChatMessage/ChatMessageToolCall/ChatMessageToolCallBlock.svelte';
	import ChatMessageActivityGroup from './ChatMessageActivityGroup.svelte';
	import ChatMessageReasoningBlock from './ChatMessageReasoningBlock.svelte';
	import ChatMessageTypingIndicator from './ChatMessageTypingIndicator.svelte';
	import {
		ChatMessageActionCardContinueRequest,
		ChatMessageActionCardPermissionRequest,
		ChatMessageStatistics,
		MarkdownContent
	} from '$lib/components/app';
	import { Card } from '$lib/components/ui/card';
	import { AgenticSectionType, ChatMessageStatsView, ToolPermissionDecision } from '$lib/enums';
	import { agenticStore, charactersStore, settingsStore } from '$lib/stores';
	import type {
		AgenticSection,
		ChatMessageAgenticTimings,
		ChatMessageAgenticTurnStats,
		DatabaseMessage
	} from '$lib/types';
	import { deriveAgenticSections } from '$lib/utils';
	import { activityStatus, activitySummary, groupActivity } from '$lib/utils/activity-groups';

	interface Props {
		message: DatabaseMessage;
		toolMessages?: DatabaseMessage[];
		isStreaming?: boolean;
		isLastAssistantMessage?: boolean;
	}

	let {
		isLastAssistantMessage = false,
		isStreaming = false,
		message,
		toolMessages = []
	}: Props = $props();

	let expandedStates: Record<number, boolean> = $state({});

	const showThoughtInProgress = $derived(Boolean(settingsStore.config.showThoughtInProgress));
	const alwaysShowToolCallContent = $derived(
		Boolean(settingsStore.config.alwaysShowToolCallContent)
	);
	const showMessageStats = $derived(Boolean(settingsStore.config.showMessageStats));
	const showAgenticTurnStats = $derived(
		showMessageStats && Boolean(settingsStore.config.showAgenticTurnStats)
	);

	const hasReasoningError = $derived(
		isLastAssistantMessage ? !!agenticStore.getLastError(message.convId) : false
	);

	const pendingPermission = $derived(
		isStreaming && isLastAssistantMessage
			? agenticStore.getPendingPermissionRequest(message.convId)
			: null
	);

	// dismissal applies to the request object, so the next request ( new
	// identity ) shows the card again without any reset bookkeeping
	let dismissedPermission: typeof pendingPermission = $state(null);

	const visiblePermission = $derived(
		pendingPermission && dismissedPermission !== pendingPermission ? pendingPermission : null
	);

	function handlePermission(decision: ToolPermissionDecision) {
		dismissedPermission = pendingPermission;
		agenticStore.resolvePermission(message.convId, decision);
	}

	const pendingContinue = $derived(
		isStreaming && isLastAssistantMessage
			? agenticStore.getPendingContinueRequest(message.convId)
			: false
	);

	let continueDismissed = $state(false);

	// the continue request is a plain boolean, so there is no identity to
	// compare against; clear the dismissal whenever no request is pending so
	// the next one starts from a clean state
	$effect(() => {
		if (!pendingContinue) {
			continueDismissed = false;
		}
	});

	const showContinue = $derived(Boolean(pendingContinue) && !continueDismissed);

	function handleContinue(shouldContinue: boolean) {
		continueDismissed = true;
		agenticStore.resolveContinue(message.convId, shouldContinue);
	}

	const sections = $derived(deriveAgenticSections(message, toolMessages, [], isStreaming));

	const currentlyExecutingToolCallId = $derived(
		isStreaming ? agenticStore.getExecutingToolCallId(message.convId) : null
	);

	type TurnGroup = {
		sections: AgenticSection[];
		flatIndices: number[];
	};

	const turnGroups: TurnGroup[] = $derived.by(() => {
		const groups: TurnGroup[] = [];

		let currentTurn: AgenticSection[] = [];
		let currentIndices: number[] = [];
		let prevWasTool = false;

		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			const isTool =
				section.type === AgenticSectionType.TOOL_CALL ||
				section.type === AgenticSectionType.TOOL_CALL_PENDING ||
				section.type === AgenticSectionType.TOOL_CALL_STREAMING;

			if (!isTool && prevWasTool && currentTurn.length > 0) {
				groups.push({ flatIndices: currentIndices, sections: currentTurn });
				currentTurn = [];
				currentIndices = [];
			}

			currentTurn.push(section);
			currentIndices.push(i);
			prevWasTool = isTool;
		}

		if (currentTurn.length > 0) {
			groups.push({ flatIndices: currentIndices, sections: currentTurn });
		}

		return groups;
	});

	// How reasoning and tool calls are shown: separate blocks (default), one expandable
	// "Thinking... / Using tools..." line, or only a typing indicator. Works the same in the
	// plain and the messenger-style layouts -- only the text sections look different there.
	const activityDisplay = $derived(charactersStore.activityDisplay);
	const live = $derived(isStreaming && isLastAssistantMessage);
	const blocks = $derived(activityDisplay === 'default' ? [] : groupActivity(sections));
	let groupExpanded: Record<number, boolean> = $state({});

	function getDefaultExpanded(section: AgenticSection): boolean {
		if (
			section.type === AgenticSectionType.TOOL_CALL ||
			section.type === AgenticSectionType.TOOL_CALL_PENDING ||
			section.type === AgenticSectionType.TOOL_CALL_STREAMING
		) {
			return alwaysShowToolCallContent;
		}

		if (section.type === AgenticSectionType.REASONING_PENDING) {
			return showThoughtInProgress;
		}

		return false;
	}

	function isExpanded(index: number, section: AgenticSection): boolean {
		if (expandedStates[index] !== undefined) {
			return expandedStates[index];
		}

		return getDefaultExpanded(section);
	}

	function toggleExpanded(index: number, section: AgenticSection) {
		const currentState = isExpanded(index, section);

		expandedStates[index] = !currentState;
	}

	function buildTurnAgenticTimings(stats: ChatMessageAgenticTurnStats): ChatMessageAgenticTimings {
		return {
			llm: stats.llm,
			toolCalls: stats.toolCalls,
			toolCallsCount: stats.toolCalls.length,
			toolsMs: stats.toolsMs,
			turns: 1
		};
	}
</script>

{#snippet renderSection(section: AgenticSection, index: number, forceOpen: boolean = false)}
	{#if section.type === AgenticSectionType.TEXT}
		{#if charactersStore.showAiBubble}
			<Card
				class="chat-message-ai-bubble max-w-[80%] rounded-[1.125rem] border-none bg-muted px-3.75 py-1.5"
				style="{charactersStore.aiBubbleColor
					? `background-color: ${charactersStore.aiBubbleColor};`
					: ''} {charactersStore.aiTextColor ? `color: ${charactersStore.aiTextColor};` : ''}"
			>
				<div class="agentic-text">
					<MarkdownContent attachments={message?.extra} content={section.content} />
				</div>
			</Card>
		{:else}
			<div class="agentic-text">
				<MarkdownContent attachments={message?.extra} content={section.content} />
			</div>
		{/if}
	{:else if section.type === AgenticSectionType.REASONING || section.type === AgenticSectionType.REASONING_PENDING}
		<ChatMessageReasoningBlock
			attachments={message?.extra}
			{hasReasoningError}
			{isStreaming}
			onToggle={() => toggleExpanded(index, section)}
			open={forceOpen || isExpanded(index, section)}
			panelKey={`${message.id}:${index}`}
			{section}
		/>
	{:else if section.type === AgenticSectionType.TOOL_CALL || section.type === AgenticSectionType.TOOL_CALL_PENDING || section.type === AgenticSectionType.TOOL_CALL_STREAMING}
		<ChatMessageToolCallBlock
			attachments={section.toolResultExtras}
			isExecuting={section.toolCallId !== undefined &&
				section.toolCallId === currentlyExecutingToolCallId}
			{isStreaming}
			onToggle={() => toggleExpanded(index, section)}
			open={forceOpen || isExpanded(index, section)}
			{section}
		/>
	{/if}
{/snippet}

<div class="agentic-content gap-2">
	{#if activityDisplay !== 'default'}
		{#each blocks as block, blockIndex (block.kind === 'text' ? `t${block.index}` : `a${block.startIndex}`)}
			{#if block.kind === 'text'}
				{@render renderSection(block.section, block.index)}
			{:else if activityDisplay === 'combined'}
				<ChatMessageActivityGroup
					active={live && blockIndex === blocks.length - 1}
					expanded={groupExpanded[block.startIndex] ?? false}
					onToggle={() =>
						(groupExpanded[block.startIndex] = !(groupExpanded[block.startIndex] ?? false))}
					status={activityStatus(block.items, currentlyExecutingToolCallId)}
					summary={activitySummary(block.items)}
				>
					{#each block.items as item (item.index)}
						{@render renderSection(item.section, item.index, true)}
					{/each}
				</ChatMessageActivityGroup>
			{:else if live && blockIndex === blocks.length - 1}
				<ChatMessageTypingIndicator />
			{/if}
		{/each}
	{:else if turnGroups.length > 1}
		{#each turnGroups as turn, turnIndex (turnIndex)}
			{@const turnStats = message?.timings?.agentic?.perTurn?.[turnIndex]}

			<div class="agentic-turn group/turn grid gap-2">
				{#each turn.sections as section, sIdx (turn.flatIndices[sIdx])}
					{@render renderSection(section, turn.flatIndices[sIdx])}
				{/each}

				{#if turnStats && showAgenticTurnStats}
					<div class="turn-stats transition-opacity duration-150 mt-1 mb-4">
						<ChatMessageStatistics
							agenticTimings={turnStats.toolCalls.length > 0
								? buildTurnAgenticTimings(turnStats)
								: undefined}
							hideSummary
							initialView={ChatMessageStatsView.GENERATION}
							predictedMs={turnStats.llm.predicted_ms}
							predictedTokens={turnStats.llm.predicted_n}
							promptMs={turnStats.llm.prompt_ms}
							promptTokens={turnStats.llm.prompt_n}
						/>
					</div>
				{/if}
			</div>
		{/each}
	{:else}
		{#each sections as section, index (index)}
			{@render renderSection(section, index)}
		{/each}
	{/if}

	{#if visiblePermission}
		<ChatMessageActionCardPermissionRequest
			onDecision={handlePermission}
			serverLabel={visiblePermission.serverLabel}
			toolName={visiblePermission.toolName}
		/>
	{/if}

	{#if showContinue}
		<ChatMessageActionCardContinueRequest onDecision={handleContinue} />
	{/if}
</div>

<style>
	.agentic-content {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 48rem;
	}

	.agentic-content > :global(*),
	.agentic-turn > :global(*) {
		min-width: 0;
	}

	.agentic-text {
		width: 100%;
	}

	.turn-stats {
		border-top: 1px solid hsl(var(--muted) / 0.5);
	}
</style>
