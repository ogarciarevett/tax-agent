import { describe, expect, it } from "vitest";
import {
	AgentScanReportSchema,
	PrintedAmountSchema,
	parsePrintedAmountCents,
	toCents,
} from "./bill";

describe("parsePrintedAmountCents / toCents", () => {
	it.each([
		["123,45", 12345],
		["123.45", 12345],
		["1234", 123400],
		["7,5", 750],
		["7.5", 750],
		["1.234,56", 123456],
		["1,234.56", 123456],
		["1.234", 123400], // trailing group of 3 = thousands (es integer amount)
		["1,234,567", 123456700],
		["0,99", 99],
		["0", 0],
	])("parses %s → %d cents", (printed, cents) => {
		expect(parsePrintedAmountCents(printed)).toBe(cents);
		expect(toCents(printed)).toBe(cents);
	});

	it.each([
		"1.23.45", // inconsistent grouping
		"12,3456", // 4 digits after separator
		"1.234.5", // bad final group
		"1.23,45", // group of 2 before decimal
		"1,234.567,8", // mixed nonsense
		"abc",
		"12,34.56.78",
		"",
		"1..2",
		"123.456,789", // 3-digit decimal after a grouped whole is a group, but trailing sep run invalid: 123456789 → over cap? (123456.789 es-grouped = 123456789 units > cap)
	])("rejects %s", (printed) => {
		expect(parsePrintedAmountCents(printed)).toBeNull();
	});

	it("rejects amounts over the sanity cap", () => {
		expect(parsePrintedAmountCents("100000000")).toBeNull(); // > 99,999,999 units
	});

	it("PrintedAmountSchema mirrors the parser", () => {
		expect(PrintedAmountSchema.safeParse("1.234,56").success).toBe(true);
		expect(PrintedAmountSchema.safeParse("1.23.45").success).toBe(false);
	});

	it("toCents throws on garbage", () => {
		expect(() => toCents("nope")).toThrow();
	});
});

const VALID_BILL = {
	gmailMessageId: "18c2f0a1b2c3d4e5",
	receivedDate: "2026-06-03",
	vendor: "Movistar",
	issueDate: "2026-06-01",
	currency: "EUR",
	total: "60,50",
	vatLines: [{ ratePct: 21, base: "50,00", vat: "10,50" }],
	category: "telecom",
	sourceQuote: "Total factura: 60,50 €",
	bodyMarkdown: "# Factura junio\nTotal factura: 60,50 €",
};

describe("AgentScanReportSchema", () => {
	it("accepts a full valid payload", () => {
		const report = AgentScanReportSchema.parse({
			bills: [VALID_BILL],
			attachmentOnly: [
				{
					gmailMessageId: "18c2f0a1b2c3d4e6",
					receivedDate: "2026-06-04",
					vendor: "Iberdrola",
				},
			],
			notBills: ["18c2f0a1b2c3d4e7"],
			hasMore: false,
		});
		expect(report.bills[0]?.vendor).toBe("Movistar");
	});

	it("rejects an unknown category", () => {
		const bad = { ...VALID_BILL, category: "yachts" };
		expect(
			AgentScanReportSchema.safeParse({
				bills: [bad],
				attachmentOnly: [],
				notBills: [],
				hasMore: false,
			}).success,
		).toBe(false);
	});

	it("rejects a non-ISO-4217-length currency", () => {
		const bad = { ...VALID_BILL, currency: "EURO" };
		expect(
			AgentScanReportSchema.safeParse({
				bills: [bad],
				attachmentOnly: [],
				notBills: [],
				hasMore: false,
			}).success,
		).toBe(false);
	});

	it("rejects a fabricated-looking total that is not a money shape", () => {
		const bad = { ...VALID_BILL, total: "about 60 euros" };
		expect(
			AgentScanReportSchema.safeParse({
				bills: [bad],
				attachmentOnly: [],
				notBills: [],
				hasMore: false,
			}).success,
		).toBe(false);
	});
});
