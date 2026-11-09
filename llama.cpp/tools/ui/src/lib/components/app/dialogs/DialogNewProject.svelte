<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { RouterService } from '$lib/services/router.service';
	import { projectsStore } from '$lib/stores';

	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	let name = $state('');
	let description = $state('');
	let isCreating = $state(false);

	async function handleCreate() {
		if (!name.trim() || isCreating) return;

		isCreating = true;

		const project = await projectsStore.createProject(name, description);

		isCreating = false;

		if (!project) return;

		name = '';
		description = '';
		open = false;

		await goto(RouterService.project(project.id));
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;

		if (!newOpen) {
			name = '';
			description = '';
		}
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-w-sm" showCloseButton>
		<Dialog.Header>
			<Dialog.Title>New Project</Dialog.Title>
			<Dialog.Description>Group related chats together.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-3 py-2">
			<div class="space-y-2">
				<Label for="new-project-name">Name</Label>
				<Input
					id="new-project-name"
					autofocus
					bind:value={name}
					onkeydown={(e) => e.key === 'Enter' && handleCreate()}
					placeholder="e.g. Website Redesign"
				/>
			</div>

			<div class="space-y-2">
				<Label for="new-project-description">Description (optional)</Label>
				<Textarea
					id="new-project-description"
					bind:value={description}
					placeholder="What is this project about?"
					rows={3}
				/>
			</div>
		</div>

		<div class="flex justify-end gap-2 border-t border-border/30 pt-3">
			<Button onclick={() => handleOpenChange(false)} variant="ghost">Cancel</Button>
			<Button disabled={!name.trim() || isCreating} onclick={handleCreate}>Create</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
