import * as SQLite from "expo-sqlite";

export type QueuedMutation = { id: string; method: string; path: string; body: unknown; dependencyId?: string; createdAt: number };
const db = SQLite.openDatabaseSync("noteschain.db");

export function initialiseOfflineStore() {
  db.execSync(`CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mutations (id TEXT PRIMARY KEY, method TEXT NOT NULL, path TEXT NOT NULL, body TEXT NOT NULL, dependencyId TEXT, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS recoveries (id TEXT PRIMARY KEY, draftId TEXT NOT NULL, body TEXT NOT NULL, createdAt INTEGER NOT NULL);`);
}

export function cacheWrite(key: string, value: unknown) {
  db.runSync("INSERT OR REPLACE INTO cache (key, value, updatedAt) VALUES (?, ?, ?)", key, JSON.stringify(value), Date.now());
}
export function cacheRead<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM cache WHERE key = ?", key);
  return row ? JSON.parse(row.value) as T : null;
}
export function enqueue(mutation: QueuedMutation) {
  db.runSync("INSERT OR REPLACE INTO mutations (id, method, path, body, dependencyId, createdAt) VALUES (?, ?, ?, ?, ?, ?)", mutation.id, mutation.method, mutation.path, JSON.stringify(mutation.body), mutation.dependencyId ?? null, mutation.createdAt);
}
export function queued(): QueuedMutation[] {
  return db.getAllSync<{ id: string; method: string; path: string; body: string; dependencyId?: string; createdAt: number }>("SELECT * FROM mutations ORDER BY createdAt")
    .map((row) => ({ ...row, body: JSON.parse(row.body) }));
}
export function removeQueued(id: string) { db.runSync("DELETE FROM mutations WHERE id = ?", id); }
export function preserveRecovery(draftId: string, body: unknown) {
  db.runSync("INSERT INTO recoveries (id, draftId, body, createdAt) VALUES (?, ?, ?, ?)", `${draftId}-${Date.now()}`, draftId, JSON.stringify(body), Date.now());
}
