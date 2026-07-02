import { describe, expect, it } from "vitest";
import { currentMonth, parseCliArgs, usage } from "./args";

const JULY = new Date(2026, 6, 15); // month is 0-based → 2026-07

describe("parseCliArgs", () => {
	it("defaults to the interview with no args", () => {
		expect(parseCliArgs([], JULY)).toEqual({ kind: "interview" });
	});

	it("parses the explicit interview command", () => {
		expect(parseCliArgs(["interview"], JULY)).toEqual({ kind: "interview" });
	});

	it("parses scan", () => {
		expect(parseCliArgs(["scan"], JULY)).toEqual({ kind: "scan" });
	});

	it("report defaults to the current month from the injected clock", () => {
		expect(parseCliArgs(["report"], JULY)).toEqual({
			kind: "report",
			month: "2026-07",
		});
	});

	it("report accepts an explicit --month", () => {
		expect(parseCliArgs(["report", "--month", "2026-06"], JULY)).toEqual({
			kind: "report",
			month: "2026-06",
		});
	});

	it("rejects a malformed --month with a clear error", () => {
		const cmd = parseCliArgs(["report", "--month", "2026-13"], JULY);
		expect(cmd.kind).toBe("help");
		expect(cmd).toMatchObject({ error: expect.stringContaining("2026-13") });
	});

	it("rejects --month with a missing value", () => {
		const cmd = parseCliArgs(["report", "--month"], JULY);
		expect(cmd.kind).toBe("help");
		expect(cmd).toMatchObject({ error: expect.stringContaining("YYYY-MM") });
	});

	it("maps help aliases to help without an error", () => {
		for (const alias of ["help", "--help", "-h"]) {
			expect(parseCliArgs([alias], JULY)).toEqual({ kind: "help" });
		}
	});

	it("flags an unknown command in the help error", () => {
		const cmd = parseCliArgs(["frobnicate"], JULY);
		expect(cmd).toEqual({
			kind: "help",
			error: 'Unknown command "frobnicate".',
		});
	});
});

describe("currentMonth", () => {
	it("zero-pads single-digit months", () => {
		expect(currentMonth(new Date(2026, 0, 3))).toBe("2026-01");
	});
});

describe("usage", () => {
	it("names every command", () => {
		const text = usage();
		for (const cmd of ["interview", "scan", "report", "help"]) {
			expect(text).toContain(cmd);
		}
	});
});
