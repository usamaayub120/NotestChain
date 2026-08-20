import * as SQLite from "expo-sqlite";

export type QueuedMutation = { id: string; method: string; path: string; body: unknown; dependencyId?: string; createdAt: number };
const db = SQLite.openDatabaseSync("noteschain.db");
let schemaReady = false;

export function initialiseOfflineStore() {
  if (schemaReady) return true;
  try {
    db.execSync(`CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, method TEXT NOT NULL, path TEXT NOT NULL, body TEXT NOT NULL, dependencyId TEXT, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS recoveries (id TEXT PRIMARY KEY, draftId TEXT NOT NULL, body TEXT NOT NULL, createdAt INTEGER NOT NULL);`);
    schemaReady = true;
    return true;
  } catch {
    // Public reading must continue when local storage is temporarily unavailable.
    return false;
  }
}

export function cacheWrite(key: string, value: unknown) {
  try {
    if (!initialiseOfflineStore()) return;
    db.runSync("INSERT OR REPLACE INTO cache (key, value, updatedAt) VALUES (?, ?, ?)", key, JSON.stringify(value), Date.now());
  } catch {
    // Caching is an enhancement, never a reason to close a reading screen.
  }
}
export function cacheRead<T>(key: string): T | null {
  try {
    if (!initialiseOfflineStore()) return null;
    const row = db.getFirstSync<{ value: string }>("SELECT value FROM cache WHERE key = ?", key);
    return row ? JSON.parse(row.value) as T : null;
  } catch {
    return null;
  }
}
export function enqueue(mutation: QueuedMutation) {
  if (!initialiseOfflineStore()) return;
  db.runSync("INSERT OR REPLACE INTO mutations (id, method, path, body, dependencyId, createdAt) VALUES (?, ?, ?, ?, ?, ?)", mutation.id, mutation.method, mutation.path, JSON.stringify(mutation.body), mutation.dependencyId ?? null, mutation.createdAt);
}
export function queued(): QueuedMutation[] {
  if (!initialiseOfflineStore()) return [];
  return db.getAllSync<{ id: string; method: string; path: string; body: string; dependencyId?: string; createdAt: number }>("SELECT * FROM mutations ORDER BY createdAt")
    .map((row) => ({ ...row, body: JSON.parse(row.body) }));
}
export function removeQueued(id: string) { if (initialiseOfflineStore()) db.runSync("DELETE FROM mutations WHERE id = ?", id); }
export function preserveRecovery(draftId: string, body: unknown) {
  if (!initialiseOfflineStore()) return;
  db.runSync("INSERT INTO recoveries (id, draftId, body, createdAt) VALUES (?, ?, ?, ?)", `${draftId}-${Date.now()}`, draftId, JSON.stringify(body), Date.now());
}
