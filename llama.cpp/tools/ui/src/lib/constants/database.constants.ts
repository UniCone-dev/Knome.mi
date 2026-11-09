/**
 * Database-related constants (IndexedDB, Dexie).
 *
 * Centralized to ensure consistency across the app and simplify future
 * naming changes.
 */

import { STORAGE_APP_NAME } from './storage.constants';

/** IndexedDB database name */
export const DB_NAME = STORAGE_APP_NAME;

/** IndexedDB store / table names */
export const IDXDB_TABLES = {
	characters: 'characters',
	conversations: 'conversations',
	messages: 'messages',
	projects: 'projects'
} as const;

/** IndexedDB store schemas */
export const IDXDB_STORE_SCHEMAS = {
	characters: 'id, lastModified, name, isUserPersona',
	conversations: 'id, lastModified, currNode, name',
	messages: 'id, convId, type, role, timestamp, parent, children',
	projects: 'id, lastModified, name'
} as const;

/**
 * v1 stores -- kept as-is for Dexie's version-chain migration (each version
 * must describe the full schema at that point, not just the diff).
 */
export const IDXDB_STORES_V1 = {
	[IDXDB_TABLES.conversations]: IDXDB_STORE_SCHEMAS.conversations,
	[IDXDB_TABLES.messages]: IDXDB_STORE_SCHEMAS.messages
} as const;

/**
 * v2 stores -- adds the `projects` table and an indexed `projectId` on
 * conversations (Projects feature). New installs open straight at this
 * version; existing installs upgrade in place via Dexie, keeping all data.
 */
export const IDXDB_STORES_V2 = {
	[IDXDB_TABLES.conversations]: `${IDXDB_STORE_SCHEMAS.conversations}, projectId`,
	[IDXDB_TABLES.messages]: IDXDB_STORE_SCHEMAS.messages,
	[IDXDB_TABLES.projects]: IDXDB_STORE_SCHEMAS.projects
} as const;

/**
 * v3 stores -- adds the `characters` table (Character Cards: AI personas
 * and user personas). Pure addition -- no existing data touched.
 */
export const IDXDB_STORES_V3 = {
	[IDXDB_TABLES.characters]: IDXDB_STORE_SCHEMAS.characters,
	[IDXDB_TABLES.conversations]: `${IDXDB_STORE_SCHEMAS.conversations}, projectId`,
	[IDXDB_TABLES.messages]: IDXDB_STORE_SCHEMAS.messages,
	[IDXDB_TABLES.projects]: IDXDB_STORE_SCHEMAS.projects
} as const;

/**
 * v4 stores -- adds an indexed `characterId` on conversations, so every chat
 * remembers which Character Card was active when it was created (WhatsApp-
 * style "all chats with this character" list). Pure addition.
 */
export const IDXDB_STORES = {
	[IDXDB_TABLES.characters]: IDXDB_STORE_SCHEMAS.characters,
	[IDXDB_TABLES.conversations]: `${IDXDB_STORE_SCHEMAS.conversations}, projectId, characterId`,
	[IDXDB_TABLES.messages]: IDXDB_STORE_SCHEMAS.messages,
	[IDXDB_TABLES.projects]: IDXDB_STORE_SCHEMAS.projects
} as const;
