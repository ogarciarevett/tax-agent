import type Database from "better-sqlite3";
import {
	DEFAULT_PROFILE_ID,
	type Profile,
	parseProfile,
} from "../domain/profile";

/** Persist the profile (insert or update — one logical row per profile id). */
export function saveProfile(db: Database.Database, profile: Profile): void {
	db.prepare(
		`INSERT INTO profile (id, data, updated_at) VALUES (@id, @data, @updated_at)
     ON CONFLICT(id) DO UPDATE SET data = @data, updated_at = @updated_at`,
	).run({
		id: profile.id,
		data: JSON.stringify(profile),
		updated_at: new Date().toISOString(),
	});
}

/** Load a stored profile, re-validating at the read boundary. Returns null if none exists. */
export function loadProfile(
	db: Database.Database,
	id = DEFAULT_PROFILE_ID,
): Profile | null {
	const row = db.prepare("SELECT data FROM profile WHERE id = ?").get(id) as
		| { data: string }
		| undefined;
	if (!row) {
		return null;
	}
	return parseProfile(JSON.parse(row.data));
}
