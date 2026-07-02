import { describe, expect, it } from "vitest";
import type { Profile } from "../domain/profile";
import { getCountryModule } from "./registry";

const PROFILE: Profile = {
	id: "me",
	country: "es",
	residency: "resident",
	taxYear: 2026,
	filingSituation: "self_employed",
};

describe("getCountryModule", () => {
	it("returns the es module for 'es'", () => {
		const mod = getCountryModule("es");
		expect(mod.code).toBe("es");
		expect(typeof mod.buildMonthReport).toBe("function");
	});

	it("builds a report through the module interface", () => {
		const report = getCountryModule("es").buildMonthReport({
			bills: [],
			profile: PROFILE,
			month: "2026-07",
		});
		expect(report.country).toBe("es");
		expect(report.figures).toEqual([]);
		expect(report.notes).toEqual(["Sin facturas en EUR para 2026-07."]);
	});
});
