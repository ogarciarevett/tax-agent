import { z } from "zod";

// Country is Spain-first. Add an ISO code here as each per-country tax module lands —
// never branch on country outside that module (see .ai/context.md hard rules).
export const CountrySchema = z.enum(["es"]);

// Spain distinguishes residents (IRPF) from non-residents (IRNR); both matter for the report.
export const ResidencySchema = z.enum(["resident", "non_resident"]);

export const FilingSituationSchema = z.enum([
	"employed",
	"self_employed",
	"both",
	"other",
]);

// The single-user profile id. Shared by the schema default and the repo so they can't drift.
export const DEFAULT_PROFILE_ID = "me";

export const ProfileSchema = z.object({
	// Single-user today; `id` is forward-compat for multiple profiles later.
	id: z.string().min(1).default(DEFAULT_PROFILE_ID),
	country: CountrySchema,
	residency: ResidencySchema,
	// Coerced so a "2025" string from the interview and a 2025 number from storage both parse.
	taxYear: z.coerce.number().int().min(2000).max(2100),
	filingSituation: FilingSituationSchema,
	// Bounded so a malformed/huge value can't bloat the row.
	fullName: z.string().min(1).max(200).optional(),
	// NIF / NIE. Deep format validation belongs to the `es` module, not this shared boundary.
	taxId: z.string().min(1).max(64).optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

/** Validate untrusted input at the boundary. Throws ZodError on invalid data. */
export function parseProfile(raw: unknown): Profile {
	return ProfileSchema.parse(raw);
}
