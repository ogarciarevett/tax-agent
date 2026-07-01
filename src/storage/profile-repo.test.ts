import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Profile } from "../domain/profile";
import { openDb } from "./db";
import { loadProfile, saveProfile } from "./profile-repo";

const profile: Profile = {
	id: "me",
	country: "es",
	residency: "resident",
	taxYear: 2025,
	filingSituation: "self_employed",
	fullName: "Omar G",
	taxId: "12345678Z",
};

describe("profile-repo", () => {
	it("returns null when no profile is stored", () => {
		const db = openDb(":memory:");
		expect(loadProfile(db)).toBeNull();
		db.close();
	});

	it("round-trips a saved profile", () => {
		const db = openDb(":memory:");
		saveProfile(db, profile);
		expect(loadProfile(db)).toEqual(profile);
		db.close();
	});

	it("upserts on repeated save (no duplicate rows)", () => {
		const db = openDb(":memory:");
		saveProfile(db, profile);
		saveProfile(db, { ...profile, taxYear: 2026 });
		expect(loadProfile(db)?.taxYear).toBe(2026);
		const count = db.prepare("SELECT COUNT(*) AS n FROM profile").get() as {
			n: number;
		};
		expect(count.n).toBe(1);
		db.close();
	});

	it("persists to an on-disk file, creating missing parent dirs, and survives reopen", () => {
		const dir = mkdtempSync(join(tmpdir(), "tax-agent-"));
		const path = join(dir, "nested", "tax-agent.sqlite");
		try {
			const db = openDb(path);
			saveProfile(db, profile);
			db.close();
			// Reopen a fresh connection from disk — the data outlived the process handle.
			const reopened = openDb(path);
			expect(loadProfile(reopened)).toEqual(profile);
			reopened.close();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
