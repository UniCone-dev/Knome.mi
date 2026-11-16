import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

vi.setConfig({ testTimeout: 60000 });

const storage = new Map<string, string>();

vi.stubGlobal('localStorage', {
	getItem: (k: string) => storage.get(k) ?? null,
	setItem: (k: string, v: string) => void storage.set(k, v),
	removeItem: (k: string) => void storage.delete(k)
});

import { isSystemControlKey, isSystemControlTool } from '$lib/constants/system-control.constants';

describe('system-control tools are never remembered', () => {
	it('recognises system_* tools by name and by key', () => {
		expect(isSystemControlTool('system_open_app')).toBe(true);
		expect(isSystemControlTool('web_search')).toBe(false);
		expect(isSystemControlKey('mcp-knome-core:system_run_command')).toBe(true);
		expect(isSystemControlKey('mcp-knome-core:save_memory')).toBe(false);
		expect(isSystemControlKey('system_info')).toBe(true);
		expect(isSystemControlTool('system')).toBe(true);
		expect(isSystemControlTool('knome-core_system')).toBe(true);
		expect(isSystemControlTool('knome-core_system_media')).toBe(true);
		expect(isSystemControlKey('mcp-knome-core:system')).toBe(true);
		expect(isSystemControlTool('knome-core_run_python')).toBe(false);
		expect(isSystemControlTool('web_search')).toBe(false);
	});

	it('permissionsStore refuses to allow them, even when asked directly', async () => {
		const { permissionsStore } = await import('$lib/stores/permissions.svelte');

		permissionsStore.allowTool('mcp-knome-core:system_run_command');
		permissionsStore.allowTools(['mcp-knome-core:system_open_app', 'mcp-knome-core:save_memory']);

		expect(permissionsStore.hasTool('mcp-knome-core:system_run_command')).toBe(false);
		expect(permissionsStore.hasTool('mcp-knome-core:system_open_app')).toBe(false);
		expect(permissionsStore.hasTool('mcp-knome-core:save_memory')).toBe(true);
	});

	it('ignores system_* entries that were stored in localStorage', async () => {
		vi.resetModules();

		const { ALWAYS_ALLOWED_TOOLS_LOCALSTORAGE_KEY } = await import('$lib/constants');

		localStorage.setItem(
			ALWAYS_ALLOWED_TOOLS_LOCALSTORAGE_KEY,
			JSON.stringify(['mcp-knome-core:system_run_command', 'mcp-knome-core:web_search'])
		);

		const { permissionsStore } = await import('$lib/stores/permissions.svelte');

		permissionsStore.initialize();

		expect(permissionsStore.hasTool('mcp-knome-core:system_run_command')).toBe(false);
		expect(permissionsStore.hasTool('mcp-knome-core:web_search')).toBe(true);
	});
});

describe('command memory', () => {
	it('keeps a command once, counts uses, and adds a guide to the prompt', async () => {
		const { commandMemoryStore } = await import('$lib/stores/command-memory.svelte');

		commandMemoryStore.clear();
		commandMemoryStore.remember('show disk space', 'df -h');
		commandMemoryStore.remember('', 'df -h');
		commandMemoryStore.remember('list usb devices', 'lsusb');

		expect(commandMemoryStore.items).toHaveLength(2);
		expect(commandMemoryStore.items.find((m) => m.command === 'df -h')?.uses).toBe(2);

		const block = commandMemoryStore.buildPromptBlock();

		expect(block).toContain('search the web');
		expect(block).toContain('- show disk space: df -h');

		commandMemoryStore.setEnabled(false);
		expect(commandMemoryStore.buildPromptBlock()).not.toContain('df -h');
	});
});
