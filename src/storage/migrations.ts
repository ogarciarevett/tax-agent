import type Database from "better-sqlite3";

// Ordered, append-only migrations gated by PRAGMA user_version. No framework: the array index is
// the version. NEVER edit a shipped entry — append a new one.
const MIGRATIONS: readonly string[] = [
	// v1 — the original A1 schema, verbatim. IF NOT EXISTS lets a pre-migrations DB (user_version=0
	// with an existing profile table) adopt cleanly; a fresh DB gets the identical table.
	`CREATE TABLE IF NOT EXISTS profile (
     id         TEXT PRIMARY KEY,
     data       TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
	// v2 — epic B: billing emails + extracted bills. One bill per email (UNIQUE email_id) —
	// ponytail: multi-bill emails are rare; split into a link table if one ever shows up.
	`CREATE TABLE emails (
     id               INTEGER PRIMARY KEY,
     gmail_message_id TEXT NOT NULL UNIQUE,
     received_date    TEXT NOT NULL,
     status           TEXT NOT NULL
                      CHECK (status IN ('billed','attachment_pending','not_a_bill','failed')),
     error_code       TEXT,
     created_at       TEXT NOT NULL
   );
   CREATE TABLE bills (
     id           INTEGER PRIMARY KEY,
     email_id     INTEGER NOT NULL UNIQUE REFERENCES emails(id),
     vendor       TEXT NOT NULL,
     issue_date   TEXT,
     currency     TEXT NOT NULL,
     total_cents  INTEGER NOT NULL CHECK (total_cents >= 0),
     vat_lines    TEXT NOT NULL,
     category     TEXT NOT NULL,
     file_path    TEXT NOT NULL,
     source_quote TEXT NOT NULL,
     extractor    TEXT NOT NULL,
     verified     INTEGER NOT NULL DEFAULT 0,
     extracted_at TEXT NOT NULL
   );`,
];

/** Bring the DB to the latest schema version. Idempotent; each step is one transaction. */
export function migrate(db: Database.Database): void {
	const current = db.pragma("user_version", { simple: true }) as number;
	for (let version = current; version < MIGRATIONS.length; version++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[version] as string);
			db.pragma(`user_version = ${version + 1}`);
		})();
	}
}
