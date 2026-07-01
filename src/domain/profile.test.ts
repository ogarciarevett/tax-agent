import { describe, expect, it } from "vitest";
import { parseProfile } from "./profile";

const valid = {
	country: "es",
	residency: "resident",
	taxYear: 2025,
	filingSituation: "self_employed",
	fullName: "Omar G",
	taxId: "12345678Z",
};

describe("ProfileSchema", () => {
	it("parses a valid profile and defaults id to 'me'", () => {
		const p = parseProfile(valid);
		expect(p.id).toBe("me");
		expect(p.country).toBe("es");
		expect(p.taxYear).toBe(2025);
	});

	it("coerces a numeric-string tax year", () => {
		expect(parseProfile({ ...valid, taxYear: "2024" }).taxYear).toBe(2024);
	});

	it("keeps optional fields absent when not provided", () => {
		const minimal = {
			country: "es",
			residency: "resident",
			taxYear: 2025,
			filingSituation: "self_employed",
		};
		const p = parseProfile(minimal);
		expect(p.fullName).toBeUndefined();
		expect(p.taxId).toBeUndefined();
	});

	it("rejects an unsupported country", () => {
		expect(() => parseProfile({ ...valid, country: "fr" })).toThrow();
	});

	it("rejects a missing tax year", () => {
		const noYear = {
			country: "es",
			residency: "resident",
			filingSituation: "employed",
		};
		expect(() => parseProfile(noYear)).toThrow();
	});

	it("rejects a non-integer tax year", () => {
		expect(() => parseProfile({ ...valid, taxYear: 2025.5 })).toThrow();
	});

	it("rejects an unknown filing situation", () => {
		expect(() =>
			parseProfile({ ...valid, filingSituation: "freelance" }),
		).toThrow();
	});
});
