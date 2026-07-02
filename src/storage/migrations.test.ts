import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "./migrations";

function tableNames(db: Database.Database): string[] {
	return (
		db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
			name: string;
		}[]
	).map((r) => r.name);
}

describe("migrate", () => {
	it("brings a fresh DB to the latest version with all tables", () => {
		const db = new Database(":memory:");
		migrate(db);
		expect(db.pragma("user_version", { simple: true })).toBe(2);
		expect(tableNames(db)).toEqual(
			expect.arrayContaining(["profile", "emails", "bills"]),
		);
	});

	it("adopts a legacy pre-migrations DB without touching its data", () => {
		const db = new Database(":memory:");
		// A1-era DB: profile table exists, user_version still 0.
		db.exec(
			`CREATE TABLE profile (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
		);
		db.prepare("INSERT INTO profile VALUES (?, ?, ?)").run(
			"me",
			'{"country":"es"}',
			"2026-01-01T00:00:00Z",
		);
		migrate(db);
		expect(db.pragma("user_version", { simple: true })).toBe(2);
		const row = db
			.prepare("SELECT data FROM profile WHERE id = 'me'")
			.get() as {
			data: string;
		};
		expect(row.data).toBe('{"country":"es"}');
	});

	it("is idempotent on re-run", () => {
		const db = new Database(":memory:");
		migrate(db);
		expect(() => migrate(db)).not.toThrow();
		expect(db.pragma("user_version", { simple: true })).toBe(2);
	});

	it("enforces the emails status CHECK", () => {
		const db = new Database(":memory:");
		migrate(db);
		expect(() =>
			db
				.prepare(
					`INSERT INTO emails (gmail_message_id, received_date, status, created_at)
           VALUES ('x', '2026-06-01', 'bogus', '2026-06-01T00:00:00Z')`,
				)
				.run(),
		).toThrow(/CHECK/);
	});
});
