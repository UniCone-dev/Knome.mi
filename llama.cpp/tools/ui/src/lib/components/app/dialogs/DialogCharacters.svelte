<script lang="ts">
	import { Drama } from '@lucide/svelte';
	import { CharacterManager } from '$lib/components/app/characters';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { onOpenChange, open = $bindable(false) }: Props = $props();

	function handleOpenChange(value: boolean) {
		open = value;
		onOpenChange?.(value);
	}
</script>

<Dialog.Root onOpenChange={handleOpenChange} {open}>
	<Dialog.Content
		class="md:h-[calc(100vh-4rem)]! md:max-h-180! md:w-[calc(100vw-4rem)]! md:max-w-160! flex flex-col"
	>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Drama class="h-5 w-5" />
				<span>Characters</span>
			</Dialog.Title>
		</Dialog.Header>

		<CharacterManager class="mt-2 min-h-0 flex-1" />
	</Dialog.Content>
</Dialog.Root>
