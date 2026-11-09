<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import ExperiencePicker from '$lib/components/app/misc/ExperiencePicker.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex flex-col gap-5 sm:max-w-2xl md:rounded-3xl">
		<div class="space-y-1">
			<Dialog.Title class="text-xl font-semibold">How should Knome feel?</Dialog.Title>
			<p class="text-sm text-muted-foreground">
				Pick a starting point. You can switch any time in Settings → Profile; nothing you set is
				lost when you switch.
			</p>
		</div>

		<ExperiencePicker />

		<Button class="self-end rounded-xl" onclick={() => (open = false)}>Continue</Button>
	</Dialog.Content>
</Dialog.Root>
