/**
 * System-control tool (open apps, play media, settings, install / remove apps, run a command).
 *
 * core-tools/system_tools.py offers ONE tool called `system` (older versions: `system_*`). The tool name
 * can reach the UI with the server name in front (`knome-core_system`), so this matches the word
 * "system" as a whole name segment. Because these tools act on the user's computer they are NEVER
 * allowed permanently: every single call asks for permission ("Allow once" only), whatever
 * "Always allow" settings exist for other tools. It fails closed: a similar name just asks every time.
 */
const SYSTEM_CONTROL_RE = /(?:^|[_:\-])system(?:_[a-z0-9_]+)?$/i;

/** true for a tool name: `system`, `system_open_app`, `knome-core_system`, `knome-core_system_media` */
export function isSystemControlTool(toolName: string): boolean {
	return SYSTEM_CONTROL_RE.test(toolName);
}

/** true for a permission / selection key such as `mcp-<server>:system` */
export function isSystemControlKey(key: string): boolean {
	const name = key.includes(':') ? key.slice(key.lastIndexOf(':') + 1) : key;

	return isSystemControlTool(name);
}
