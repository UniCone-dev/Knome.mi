<script lang="ts">
	import { Smile } from '@lucide/svelte';
	import ChatFormActionEmojiPicker from './ChatFormActionEmojiPicker.svelte';
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

	// stays open so several emojis can be added in a row
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
					<span class="sr-only">Emoji</span>
					<Smile class={ICON_CLASS_DEFAULT} />
				</Button>
			</Popover.Trigger>
		</Tooltip.Trigger>

		<Tooltip.Content>
			<p>Emoji</p>
		</Tooltip.Content>
	</Tooltip.Root>

	<Popover.Content align="start" class="w-auto p-0" side="top">
		<ChatFormActionEmojiPicker {onInsert} />
	</Popover.Content>
</Popover.Root>
