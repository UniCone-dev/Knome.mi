import { AttachmentType, ReasoningEffort, ToolSource } from '$lib/enums';
import type { ChatMessageTimings, ChatMessageType, ChatRole } from '$lib/types/chat';

/**
 * @deprecated Legacy per-conversation MCP server flags. MCP server enabled
 * state is global now; per-conversation tool policy lives in
 * `disabledTools` / `disabledToolCategories`. Read by the migration only.
 */
export interface McpServerOverride {
	serverId: string;
	enabled: boolean;
}

export interface DatabaseConversation {
	currNode: string | null;
	id: string;
	lastModified: number;
	name: string;
	/** @deprecated See {@link McpServerOverride}. Kept on rows for downgrade compatibility. */
	mcpServerOverrides?: McpServerOverride[];
	thinkingEnabled?: boolean;
	reasoningEffort?: ReasoningEffort;
	cwd?: string;
	/** Tool keys disabled for this conversation, incl. server-scoped MCP group keys (`mcp:<serverId>`) */
	disabledTools?: string[];
	/** Tool categories disabled for this conversation */
	disabledToolCategories?: ToolSource[];
	forkedFromConversationId?: string;
	pinned?: boolean;
	/** Hidden from the sidebar until "Show hidden chats" is switched on (nothing is deleted). */
	hidden?: boolean;
	/** Project this conversation is filed under, if any (see {@link DatabaseProject}). */
	projectId?: string;
	/** Character Card active when this chat was created, if any -- powers WhatsApp-mode's "all chats with this character" list. */
	characterId?: string;
}

/**
 * A Projects folder -- purely organisational, groups conversations together
 * (Claude-style "Projects"). No behavior of its own; conversations just
 * carry an optional `projectId` pointing at one of these.
 */
export interface DatabaseProject {
	id: string;
	name: string;
	description?: string;
	lastModified: number;
	createdAt: number;
}

/**
 * A Character Card -- an AI persona (or, with `isUserPersona`, the user's
 * own persona) that can be picked as "active" and gets woven into the
 * system prompt of every new conversation app-wide (see
 * `charactersStore.buildPersonaSystemPromptBlock`). Modeled after the
 * kobold.cpp / SillyTavern character-card idea: a portrait plus a
 * behavior/personality block that actually drives how the model talks.
 */
export interface DatabaseCharacter {
	id: string;
	name: string;
	/** Free-text gender description (not an enum -- characters aren't limited to a fixed list). */
	gender?: string;
	/** Portrait/avatar as a data: URL. Static image, animated GIF, or a short MP4 (see avatarKind). */
	avatarUrl?: string;
	avatarKind?: 'image' | 'gif' | 'video';
	/** Appearance / background / bio -- what the character IS. */
	description?: string;
	/** Behavior, speech style, personality -- how the model should actually roleplay them. Injected into the system prompt. */
	personality?: string;
	/** Optional in-character greeting shown/sent when a chat with this character starts. */
	firstMessage?: string;
	tags?: string[];
	/** True for a "who the user is" persona card rather than an AI character. */
	isUserPersona?: boolean;
	lastModified: number;
	createdAt: number;
}

export interface DatabaseMessageExtraAudioFile {
	type: AttachmentType.AUDIO;
	name: string;
	size?: number;
	base64Data: string;
	mimeType: string;
}

export interface DatabaseMessageExtraVideoFile {
	type: AttachmentType.VIDEO;
	name: string;
	size?: number;
	base64Data: string;
	mimeType: string;
}

export interface DatabaseMessageExtraImageFile {
	type: AttachmentType.IMAGE;
	name: string;
	size?: number;
	base64Url: string;
}

/**
 * Legacy format from the old UI — pasted content was stored as "context" type
 * @deprecated Use DatabaseMessageExtraTextFile instead
 */
export interface DatabaseMessageExtraLegacyContext {
	type: AttachmentType.LEGACY_CONTEXT;
	name: string;
	size?: number;
	content: string;
}

export interface DatabaseMessageExtraPdfFile {
	type: AttachmentType.PDF;
	base64Data: string;
	name: string;
	size?: number;
	content: string;
	images?: string[];
	processedAsImages: boolean;
}

export interface DatabaseMessageExtraTextFile {
	type: AttachmentType.TEXT;
	name: string;
	size?: number;
	content: string;
}

export interface DatabaseMessageExtraMcpPrompt {
	type: AttachmentType.MCP_PROMPT;
	name: string;
	size?: number;
	serverName: string;
	promptName: string;
	content: string;
	arguments?: Record<string, string>;
}

export interface DatabaseMessageExtraMcpResource {
	type: AttachmentType.MCP_RESOURCE;
	name: string;
	size?: number;
	uri: string;
	serverName: string;
	content: string;
	mimeType?: string;
}

export type DatabaseMessageExtra =
	| DatabaseMessageExtraImageFile
	| DatabaseMessageExtraTextFile
	| DatabaseMessageExtraAudioFile
	| DatabaseMessageExtraVideoFile
	| DatabaseMessageExtraPdfFile
	| DatabaseMessageExtraMcpPrompt
	| DatabaseMessageExtraMcpResource
	| DatabaseMessageExtraLegacyContext;

export interface DatabaseMessage {
	id: string;
	convId: string;
	type: ChatMessageType;
	timestamp: number;
	role: ChatRole;
	content: string;
	parent: string | null;
	/**
	 * @deprecated - left for backward compatibility
	 */
	thinking?: string;
	/** Reasoning content produced by the model (separate from visible content) */
	reasoningContent?: string;
	/** Serialized JSON array of tool calls made by assistant messages */
	toolCalls?: string;
	/** Chat completion id streamed by the server, used to target realtime control (e.g. end reasoning) */
	completionId?: string;
	/** Tool call ID for tool result messages (role: 'tool') */
	toolCallId?: string;
	/** Working directory the tool call ran with (sent via the x-tool-cwd header), stored per call so the UI can show it accurately even after the conversation cwd changes */
	toolCwd?: string;
	/** Internal flag marking a UI-generated message (e.g. a cwd change). The row is sent to the model as a "user" turn so chat templates accept it; the flag is only read by the renderer. */
	isSynthetic?: boolean;
	children: string[];
	extra?: DatabaseMessageExtra[];
	timings?: ChatMessageTimings;
	model?: string;
}

/** The character card of a chat, embedded in exports so an import can find (or recreate) the character. */
export type ExportedCharacterCard = {
	id?: string;
	name: string;
	gender?: string;
	avatarUrl?: string;
	avatarKind?: 'image' | 'gif' | 'video';
	description?: string;
	personality?: string;
	firstMessage?: string;
	tags?: string[];
	isUserPersona?: boolean;
};

export type ExportedConversation = {
	conv: DatabaseConversation;
	messages: DatabaseMessage[];
	/** The character this chat was with, when it had one. */
	character?: ExportedCharacterCard;
};

export type ExportedConversations = ExportedConversation | ExportedConversation[];
