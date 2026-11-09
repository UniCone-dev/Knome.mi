<script lang="ts">
	import { Calculator } from '@lucide/svelte';
	import ChatFormActionMathKeypad from './ChatFormActionMathKeypad.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { ICON_CLASS_DEFAULT } from '$lib/constants';

	interface Props {
		disabled?: boolean;
		onInsert: (text: string) => void;
	}

	let { disabled = false, onInsert }: Props = $props();

	let open = $state(false);

	function handleInsert(text: string) {
		onInsert(text);
		// keep the panel open -- inserting several symbols in a row (e.g.
		// building "x²+y²=z²") shouldn't require reopening it each time
	}
</script>

<Popover.Root bind:open>
	<Tooltip.Root>
		<Tooltip.Trigger class="w-full">
			<Popover.Trigger>
				<Button
					class="md:h-8 md:w-8 h-9 w-9 rounded-full p-0"
					{disabled}
					type="button"
					variant="secondary"
				>
					<span class="sr-only">Math symbols</span>
					<Calculator class={ICON_CLASS_DEFAULT} />
				</Button>
			</Popover.Trigger>
		</Tooltip.Trigger>

		<Tooltip.Content>
			<p>Math symbols</p>
		</Tooltip.Content>
	</Tooltip.Root>

	<Popover.Content align="start" class="w-auto p-0" side="top">
		<ChatFormActionMathKeypad onInsert={handleInsert} />
	</Popover.Content>
</Popover.Root>
