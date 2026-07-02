import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { migrate } from "./migrations";

export const DEFAULT_DB_PATH = "data/tax-agent.sqlite";

/**
 * Open (and migrate) the on-device SQLite DB. Pass ":memory:" in tests.
 * The `profile` row stores the whole validated profile as JSON — the dataset is tiny and
 * single-user, so a wide column-per-field schema isn't worth it yet.
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
	// The daily cron writer and a TUI reader can now contend: durable-enough sync + a wait
	// instead of an instant SQLITE_BUSY (deferred debt from .ai/specs/03-review.md).
	db.pragma("synchronous = NORMAL");
	db.pragma("busy_timeout = 5000");
	migrate(db);
	return db;
}
