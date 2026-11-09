<script lang="ts">
	import { Folder, MessageSquare, Pencil, Plus, Trash2, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { DatabaseService } from '$lib/services/database.service';
	import { RouterService } from '$lib/services/router.service';
	import { conversationsStore, projectsStore } from '$lib/stores';
	import { toast } from 'svelte-sonner';

	let projectId = $derived(page.params.id);
	let project = $derived(projectsStore.getProject(projectId ?? ''));

	let conversationsInProject = $derived(
		conversationsStore.conversations
			.filter((c) => c.projectId === projectId)
			.sort((a, b) => b.lastModified - a.lastModified)
	);

	let showDeleteConfirm = $state(false);

	async function handleRename() {
		if (!project) return;

		const newName = window.prompt('Rename project', project.name);

		if (newName && newName.trim()) {
			await projectsStore.renameProject(project.id, newName.trim());
		}
	}

	async function handleDeleteProject() {
		if (!project) return;

		await projectsStore.deleteProject(project.id);
		await goto('#/');
	}

	async function handleNewChatInProject() {
		if (!projectId) return;

		await conversationsStore.openNewChat();
		conversationsStore.preferences.pendingProjectId = projectId;
	}

	async function handleRemoveFromProject(conversationId: string) {
		try {
			await DatabaseService.setConversationProject(conversationId, undefined);

			conversationsStore.conversations = conversationsStore.conversations.map((c) =>
				c.id === conversationId ? { ...c, projectId: undefined } : c
			);
		} catch (error) {
			console.error('Failed to remove conversation from project:', error);
			toast.error('Failed to remove conversation from project');
		}
	}

	async function handleDeleteConversation(conversationId: string, name: string) {
		const confirmed = window.confirm(`Delete "${name}"? This action cannot be undone.`);

		if (!confirmed) return;

		await conversationsStore.deleteConversation(conversationId, { deleteWithForks: false });
	}
</script>

<svelte:head>
	<title>{project?.name ?? 'Project'} · llama.cpp</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	{#if !project}
		<p class="text-muted-foreground">This project doesn't exist (anymore).</p>
	{:else}
		<div class="mb-6 flex items-start justify-between gap-4">
			<div class="flex min-w-0 items-start gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
				>
					<Folder class="h-5 w-5" />
				</div>

				<div class="min-w-0">
					<h1 class="truncate text-xl font-semibold">{project.name}</h1>

					{#if project.description}
						<p class="mt-1 text-sm text-muted-foreground">{project.description}</p>
					{/if}
				</div>
			</div>

			<div class="flex shrink-0 gap-1">
				<Button onclick={handleRename} size="icon" variant="ghost">
					<Pencil class="h-4 w-4" />
				</Button>

				{#if !showDeleteConfirm}
					<Button onclick={() => (showDeleteConfirm = true)} size="icon" variant="ghost">
						<Trash2 class="h-4 w-4" />
					</Button>
				{/if}
			</div>
		</div>

		{#if showDeleteConfirm}
			<div class="mb-6 flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 p-3">
				<p class="text-sm">
					Delete this project? Its {conversationsInProject.length} chat{conversationsInProject.length ===
					1
						? ''
						: 's'} will stay in your sidebar, unsorted.
				</p>

				<div class="flex shrink-0 gap-2">
					<Button onclick={() => (showDeleteConfirm = false)} size="sm" variant="ghost">
						Cancel
					</Button>
					<Button onclick={handleDeleteProject} size="sm" variant="destructive">Delete</Button>
				</div>
			</div>
		{/if}

		<Button class="mb-6 w-full" onclick={handleNewChatInProject} variant="outline">
			<Plus class="h-4 w-4" />
			New chat in this project
		</Button>

		<div class="space-y-1">
			{#if conversationsInProject.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No chats in this project yet.
				</p>
			{:else}
				{#each conversationsInProject as conversation (conversation.id)}
					<div
						class="group flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent"
					>
						<a
							class="flex min-w-0 flex-1 items-center gap-2"
							href={RouterService.chat(conversation.id)}
						>
							<MessageSquare class="h-4 w-4 shrink-0 text-muted-foreground" />
							<span class="truncate text-sm">{conversation.name}</span>
						</a>

						<button
							aria-label="Remove from project"
							class="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
							onclick={() => handleRemoveFromProject(conversation.id)}
							title="Remove from project"
							type="button"
						>
							<X class="h-3.5 w-3.5" />
						</button>

						<button
							aria-label="Delete conversation"
							class="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
							onclick={() => handleDeleteConversation(conversation.id, conversation.name)}
							title="Delete"
							type="button"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
