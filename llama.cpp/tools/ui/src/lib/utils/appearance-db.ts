/**
 * Tiny IndexedDB key-value helper for the Appearance feature. It is deliberately separate from the
 * Dexie database (conversations, characters ...): a big background image must not live in
 * localStorage (5 MB limit), and this keeps the main database schema untouched.
 * Every call fails soft (private windows, blocked storage): it resolves undefined / false.
 */

import { APPEARANCE_DB_NAME, APPEARANCE_DB_STORE } from '$lib/constants/appearance.constants';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(APPEARANCE_DB_NAME, 1);

		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(APPEARANCE_DB_STORE)) {
				request.result.createObjectStore(APPEARANCE_DB_STORE);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await openDb();

	try {
		return await new Promise<T>((resolve, reject) => {
			const tx = db.transaction(APPEARANCE_DB_STORE, mode);
			const request = work(tx.objectStore(APPEARANCE_DB_STORE));

			tx.oncomplete = () => resolve(request.result);
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

export async function appearanceDbGet<T>(key: string): Promise<T | undefined> {
	try {
		return (await run('readonly', (s) => s.get(key))) as T | undefined;
	} catch (error) {
		console.warn('[appearance] could not read', key, error);

		return undefined;
	}
}

export async function appearanceDbSet(key: string, value: unknown): Promise<boolean> {
	try {
		await run('readwrite', (s) => s.put(value, key));

		return true;
	} catch (error) {
		console.warn('[appearance] could not save', key, error);

		return false;
	}
}

export async function appearanceDbDelete(key: string): Promise<void> {
	try {
		await run('readwrite', (s) => s.delete(key));
	} catch (error) {
		console.warn('[appearance] could not delete', key, error);
	}
}
