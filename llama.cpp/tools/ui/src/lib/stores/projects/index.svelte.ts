/**
 * projectsStore - Projects CRUD and the active-project scoping used by the
 * sidebar and the project detail route.
 *
 * Projects are purely organisational: a project just groups conversations
 * together via `DatabaseConversation.projectId`. Deleting a project never
 * deletes its conversations -- they just fall back to "unsorted".
 */

import { browser } from '$app/environment';
import { DatabaseService } from '$lib/services/database.service';
import { toast } from 'svelte-sonner';

class ProjectsStore {
	/** All projects, most recently modified first. */
	projects = $state<DatabaseProject[]>([]);

	/** Whether the store has loaded at least once. */
	isInitialized = $state(false);

	private initPromise: Promise<void> | null = null;

	/**
	 * Initialize the store by loading projects from the database. Safe to
	 * call multiple times: concurrent callers share a single run.
	 */
	initialize(): Promise<void> {
		if (!browser) return Promise.resolve();

		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			try {
				await this.loadProjects();
				this.isInitialized = true;
			} catch (error) {
				console.error('Failed to initialize projects:', error);
				this.initPromise = null;
			}
		})();

		return this.initPromise;
	}

	async loadProjects(): Promise<void> {
		this.projects = await DatabaseService.getAllProjects();
	}

	async createProject(name: string, description?: string): Promise<DatabaseProject | null> {
		const trimmed = name.trim();

		if (!trimmed) return null;

		try {
			const project = await DatabaseService.createProject(trimmed, description?.trim());

			this.projects = [project, ...this.projects];

			return project;
		} catch (error) {
			console.error('Failed to create project:', error);
			toast.error('Failed to create project');

			return null;
		}
	}

	async renameProject(id: string, name: string): Promise<void> {
		const trimmed = name.trim();

		if (!trimmed) return;

		try {
			await DatabaseService.updateProject(id, { name: trimmed });

			this.projects = this.projects.map((p) =>
				p.id === id ? { ...p, name: trimmed, lastModified: Date.now() } : p
			);
		} catch (error) {
			console.error('Failed to rename project:', error);
			toast.error('Failed to rename project');
		}
	}

	async updateProjectDescription(id: string, description: string): Promise<void> {
		try {
			await DatabaseService.updateProject(id, { description: description.trim() });

			this.projects = this.projects.map((p) =>
				p.id === id ? { ...p, description: description.trim(), lastModified: Date.now() } : p
			);
		} catch (error) {
			console.error('Failed to update project description:', error);
			toast.error('Failed to update project');
		}
	}

	async deleteProject(id: string): Promise<void> {
		try {
			await DatabaseService.deleteProject(id);

			this.projects = this.projects.filter((p) => p.id !== id);
			toast.success('Project deleted -- its chats are still in your sidebar, unsorted');
		} catch (error) {
			console.error('Failed to delete project:', error);
			toast.error('Failed to delete project');
		}
	}

	getProject(id: string): DatabaseProject | undefined {
		return this.projects.find((p) => p.id === id);
	}
}

export const projectsStore = new ProjectsStore();
