import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export const DEFAULT_DB_PATH = "data/tax-agent.sqlite";

/**
 * Open (and initialise) the on-device SQLite DB. Pass ":memory:" in tests.
 * The `profile` row stores the whole validated profile as JSON — the dataset is tiny and
 * single-user, so a wide column-per-field schema (and its migrations) isn't worth it yet.
 * ponytail: JSON blob store — move to typed columns if we ever need to query by field.
 */
export function openDb(path: string = DEFAULT_DB_PATH): Database.Database {
	if (path !== ":memory:") {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	}
	const db = new Database(path);
	if (path !== ":memory:") {
		// PII at rest → owner-only. WAL/SHM sidecars inherit the DB file's mode in better-sqlite3.
		chmodSync(path, 0o600);
	}
	db.pragma("journal_mode = WAL");
	db.exec(
		`CREATE TABLE IF NOT EXISTS profile (
       id         TEXT PRIMARY KEY,
       data       TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
	);
	return db;
}
