<script lang="ts">
	import { ChevronDown, ShieldAlert, ShieldQuestion } from '@lucide/svelte';
	import { ChatMessageActionCard } from '$lib/components/app';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as ButtonGroup from '$lib/components/ui/button-group';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { cn } from '$lib/components/ui/utils';
	import { TOOL_SERVER_LABELS } from '$lib/constants';
	import { ToolPermissionDecision, ToolSource } from '$lib/enums';
	import { toolsStore } from '$lib/stores';

	interface Props {
		toolName: string;
		serverLabel: string;
		/** raw JSON arguments of the call, shown for system-control tools so the user sees exactly what will run */
		args?: string;
		/** system-control tool: no "always allow", every call asks */
		onceOnly?: boolean;
		onDecision: (decision: ToolPermissionDecision) => void;
	}

	let { args, onDecision, onceOnly = false, serverLabel, toolName }: Props = $props();

	// readable text of the arguments: {"command":"vlc x.mp3"} -> command: vlc x.mp3
	const argsText = $derived.by(() => {
		if (!args) return '';

		try {
			const obj = JSON.parse(args) as Record<string, unknown>;

			return Object.entries(obj)
				.map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
				.join('\n');
		} catch {
			return args;
		}
	});
</script>

<ChatMessageActionCard icon={onceOnly ? ShieldAlert : ShieldQuestion}>
	{#snippet message()}
		{#if onceOnly}
			<span class="font-semibold">Knome wants to control this computer</span>: allow
			<span class="font-semibold">{toolName}</span>?
			{#if argsText}
				<pre
					class="mt-2 max-h-40 overflow-auto rounded-md bg-muted px-3 py-2 text-xs whitespace-pre-wrap">{argsText}</pre>
			{/if}
			<span class="mt-1 block text-xs text-muted-foreground"
				>Read it first. This permission is asked every time and can never be saved.</span
			>
		{:else}
			Allow use of <span class="font-semibold">{toolName}</span>{#if serverLabel}
				&nbsp;from <span class="font-semibold">{serverLabel}</span>{/if}?
		{/if}
	{/snippet}

	{#snippet actions()}
		{#if onceOnly}
			<Button onclick={() => onDecision(ToolPermissionDecision.ONCE)} size="sm" variant="secondary">
				Allow once
			</Button>
		{:else}
			<DropdownMenu.Root>
				<ButtonGroup.Root class="overflow-hidden rounded-md shadow-sm">
					<Button
						class="!rounded-r-none !shadow-none"
						onclick={() => onDecision(ToolPermissionDecision.ONCE)}
						size="sm"
						variant="secondary"
					>
						Allow once
					</Button>

					<ButtonGroup.Separator />

					<DropdownMenu.Trigger
						aria-label="More allow options"
						class={cn(
							buttonVariants({ size: 'sm', variant: 'secondary' }),
							'inline-flex cursor-pointer items-center !rounded-l-none !shadow-none !px-2'
						)}
					>
						<ChevronDown class="h-3.5 w-3.5" />
					</DropdownMenu.Trigger>
				</ButtonGroup.Root>

				<DropdownMenu.Content align="start" class="min-w-[8rem]">
					<DropdownMenu.Item onclick={() => onDecision(ToolPermissionDecision.ALWAYS)}>
						Always allow <pre>{toolName}</pre>
						tool
					</DropdownMenu.Item>

					{#if serverLabel}
						<DropdownMenu.Item onclick={() => onDecision(ToolPermissionDecision.ALWAYS_SERVER)}>
							Always allow all tools from {serverLabel}
						</DropdownMenu.Item>
					{:else}
						{@const source = toolsStore.getToolSource(toolName)}
						{@const providerName =
							source === ToolSource.SERVER
								? TOOL_SERVER_LABELS[ToolSource.SERVER]
								: source === ToolSource.CUSTOM
									? TOOL_SERVER_LABELS[ToolSource.CUSTOM]
									: 'MCP Tools'}
						<DropdownMenu.Item onclick={() => onDecision(ToolPermissionDecision.ALWAYS_SERVER)}>
							Approve all tools from {providerName}
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}

		<Button onclick={() => onDecision(ToolPermissionDecision.DENY)} size="sm" variant="destructive">
			Deny
		</Button>
	{/snippet}
</ChatMessageActionCard>
