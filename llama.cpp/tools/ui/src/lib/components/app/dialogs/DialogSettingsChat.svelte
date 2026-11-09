<script lang="ts">
	import { SettingsChat } from '$lib/components/app/settings';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		initialSection?: string;
	}

	let { initialSection, onOpenChange, open = $bindable(false) }: Props = $props();

	function handleOpenChange(value: boolean) {
		open = value;
		onOpenChange?.(value);
	}
</script>

<Dialog.Root onOpenChange={handleOpenChange} {open}>
	<Dialog.Content
		class="settings-dialog flex flex-col gap-0 overflow-hidden rounded-none p-0 max-md:h-dvh max-md:w-full md:h-[calc(100vh-4rem)]! md:max-h-220! md:w-[calc(100vw-4rem)]! md:max-w-5xl! md:rounded-2xl"
		showCloseButton
	>
		<Dialog.Title class="sr-only">Settings</Dialog.Title>

		<SettingsChat {initialSection} onClose={() => (open = false)} onSectionChange={() => {}} />
	</Dialog.Content>
</Dialog.Root>
