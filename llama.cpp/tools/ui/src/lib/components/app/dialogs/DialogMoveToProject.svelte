<script lang="ts">
	import { Folder, FolderPlus, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { DatabaseService } from '$lib/services/database.service';
	import { conversationsStore, projectsStore } from '$lib/stores';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		conversation: DatabaseConversation;
	}

	let { conversation, open = $bindable() }: Props = $props();

	let showNewProjectInput = $state(false);
	let newProjectName = $state('');

	async function moveTo(projectId: string | undefined) {
		try {
			await DatabaseService.setConversationProject(conversation.id, projectId);

			// keep the in-memory list (used by the sidebar) in sync without a
			// full reload
			if (conversationsStore.activeConversation?.id === conversation.id) {
				conversationsStore.activeConversation = {
					...conversationsStore.activeConversation,
					projectId
				};
			}

			conversationsStore.conversations = conversationsStore.conversations.map((c) =>
				c.id === conversation.id ? { ...c, projectId } : c
			);

			toast.success(projectId ? 'Moved to project' : 'Removed from project');
			open = false;
		} catch (error) {
			console.error('Failed to move conversation:', error);
			toast.error('Failed to move conversation');
		}
	}

	async function createAndMoveTo() {
		const project = await projectsStore.createProject(newProjectName);

		if (!project) return;

		newProjectName = '';
		showNewProjectInput = false;
		await moveTo(project.id);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-sm" showCloseButton>
		<Dialog.Header>
			<Dialog.Title>Move to Project</Dialog.Title>
			<Dialog.Description>Organize "{conversation.name}" into a project.</Dialog.Description>
		</Dialog.Header>

		<div class="max-h-64 space-y-1 overflow-y-auto py-2">
			{#if conversation.projectId}
				<button
					class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
					onclick={() => moveTo(undefined)}
					type="button"
				>
					<X class="h-4 w-4" />
					Remove from project
				</button>
			{/if}

			{#each projectsStore.projects as project (project.id)}
				<button
					class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent {project.id ===
					conversation.projectId
						? 'bg-primary/10 text-primary'
						: ''}"
					onclick={() => moveTo(project.id)}
					type="button"
				>
					<Folder class="h-4 w-4 shrink-0" />
					<span class="truncate">{project.name}</span>
				</button>
			{/each}

			{#if projectsStore.projects.length === 0 && !showNewProjectInput}
				<p class="px-3 py-2 text-sm text-muted-foreground">No projects yet.</p>
			{/if}
		</div>

		{#if showNewProjectInput}
			<div class="flex items-center gap-2 border-t border-border/30 pt-3">
				<Input
					autofocus
					bind:value={newProjectName}
					onkeydown={(e) => e.key === 'Enter' && createAndMoveTo()}
					placeholder="Project name"
				/>
				<Button disabled={!newProjectName.trim()} onclick={createAndMoveTo} size="sm">
					Create
				</Button>
			</div>
		{:else}
			<Button
				class="w-full justify-start border-t border-border/30 pt-3"
				onclick={() => (showNewProjectInput = true)}
				variant="ghost"
			>
				<FolderPlus class="h-4 w-4" />
				New project
			</Button>
		{/if}
	</Dialog.Content>
</Dialog.Root>
