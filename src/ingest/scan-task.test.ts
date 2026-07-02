import { describe, expect, it } from "vitest";
import { BillCategorySchema } from "../domain/bill";
import {
	FABRICATED_TOTAL_REPLY,
	FENCED_REPLY,
	INVALID_THEN_VALID,
	VALID_REPLY,
} from "./fixtures";
import {
	buildRetryPrompt,
	buildScanPrompt,
	parseAgentReply,
} from "./scan-task";

describe("buildScanPrompt", () => {
	const prompt = buildScanPrompt("2026-06-01");

	it("carries the billing search keywords and the watermark", () => {
		expect(prompt).toContain(
			"factura OR invoice OR receipt OR recibo OR billing",
		);
		expect(prompt).toContain("2026-06-01");
	});

	it("tells the agent to skip Spam and Trash and its own mail", () => {
		expect(prompt).toContain("Spam");
		expect(prompt).toContain("Trash");
		expect(prompt).toMatch(/sent themselves/i);
	});

	it("forbids computing or guessing amounts", () => {
		expect(prompt).toMatch(/never compute/i);
		expect(prompt).toMatch(/never guess/i);
	});

	it("lists every category from the frozen enum", () => {
		for (const category of BillCategorySchema.options) {
			expect(prompt).toContain(category);
		}
	});

	it("names every top-level contract field", () => {
		for (const field of [
			"sourceQuote",
			"bodyMarkdown",
			"vatLines",
			"attachmentOnly",
			"notBills",
			"hasMore",
		]) {
			expect(prompt).toContain(field);
		}
	});

	it("uses the default thread cap and honours an override", () => {
		expect(prompt).toContain("at most 8");
		expect(buildScanPrompt("2026-06-01", 5)).toContain("at most 5");
	});
});

describe("parseAgentReply", () => {
	it("parses a clean JSON reply", () => {
		const result = parseAgentReply(VALID_REPLY);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.report.bills).toHaveLength(2);
			expect(result.report.attachmentOnly).toHaveLength(1);
			expect(result.report.notBills).toEqual(["msg-newsletter-04"]);
		}
	});

	it("strips code fences and surrounding prose", () => {
		const result = parseAgentReply(FENCED_REPLY);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.report.bills[0]?.vendor).toBe("Acme SL");
		}
	});

	it("reports the zod issue path for a contract violation", () => {
		const [invalid] = INVALID_THEN_VALID;
		const result = parseAgentReply(invalid);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toContain("total");
		}
	});

	it("recovers on the valid retry of an invalid→valid pair", () => {
		const [, valid] = INVALID_THEN_VALID;
		expect(parseAgentReply(valid).ok).toBe(true);
	});

	it("fails with a reason when no JSON object is present", () => {
		const result = parseAgentReply("I could not find any billing emails.");
		expect(result).toEqual({
			ok: false,
			reason: "No JSON object found in the reply.",
		});
	});

	it("fails with a reason when the JSON is malformed", () => {
		const result = parseAgentReply('{ "bills": [ , ] }');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toMatch(/not valid JSON/i);
		}
	});

	it("carries a parseable fabricated-total reply through to verification", () => {
		// The fabricated-total fixture is contract-valid JSON — the gate rejects it, not the parser.
		expect(parseAgentReply(FABRICATED_TOTAL_REPLY).ok).toBe(true);
	});
});

describe("buildRetryPrompt", () => {
	it("appends the reason and re-states the JSON-only requirement", () => {
		const retry = buildRetryPrompt("ORIGINAL", "bills.0.total: bad amount");
		expect(retry).toContain("ORIGINAL");
		expect(retry).toContain("bills.0.total: bad amount");
		expect(retry).toMatch(/ONLY valid JSON/);
	});
});
