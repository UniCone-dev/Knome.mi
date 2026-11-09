<script lang="ts">
	import { ChevronDown, ChevronRight, Folder, Plus } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { DialogNewProject } from '$lib/components/app';
	import { TruncatedText } from '$lib/components/app';
	import { RouterService } from '$lib/services/router.service';
	import { projectsStore } from '$lib/stores';

	let showNewProjectDialog = $state(false);
	let isExpanded = $state(true);

	let activeProjectId = $derived(
		page.url.hash.startsWith('#/project/') ? page.params.id : undefined
	);

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="flex flex-col gap-0.5">
		<div class="flex items-center justify-between px-2 py-1">
			<button
				class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
				onclick={toggleExpanded}
				type="button"
			>
				{#if isExpanded}
					<ChevronDown class="h-3 w-3" />
				{:else}
					<ChevronRight class="h-3 w-3" />
				{/if}
				Projects
			</button>

			<button
				aria-label="New project"
				class="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
				onclick={() => (showNewProjectDialog = true)}
				type="button"
			>
				<Plus class="h-3.5 w-3.5" />
			</button>
		</div>

		{#if isExpanded}
			{#if projectsStore.projects.length === 0}
				<button
					class="mx-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
					onclick={() => (showNewProjectDialog = true)}
					type="button"
				>
					+ New project
				</button>
			{:else}
				{#each projectsStore.projects as project (project.id)}
					<button
						class="mx-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent {activeProjectId ===
						project.id
							? 'bg-primary/10 text-primary'
							: ''}"
						onclick={() => goto(RouterService.project(project.id))}
						type="button"
					>
						<Folder class="h-3.5 w-3.5 shrink-0" />
						<TruncatedText class="flex-1" showTooltip={false} text={project.name} />
					</button>
				{/each}
			{/if}
		{/if}
	</div>

<DialogNewProject bind:open={showNewProjectDialog} />
