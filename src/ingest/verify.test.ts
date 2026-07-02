import { describe, expect, it } from "vitest";
import type { AgentBill } from "../domain/bill";
import {
	ARITHMETIC_MISMATCH_REPLY,
	FABRICATED_TOTAL_REPLY,
	VALID_REPLY,
} from "./fixtures";
import { parseAgentReply } from "./scan-task";
import { normalizeAmountTokens, verifyBill } from "./verify";

function billFrom(reply: string, index = 0): AgentBill {
	const result = parseAgentReply(reply);
	if (!result.ok) {
		throw new Error(`fixture did not parse: ${result.reason}`);
	}
	const bill = result.report.bills[index];
	if (!bill) {
		throw new Error(`no bill at index ${index}`);
	}
	return bill;
}

const BASE_BILL: AgentBill = {
	gmailMessageId: "msg-x",
	receivedDate: "2026-06-10",
	vendor: "Test SL",
	issueDate: "2026-06-10",
	currency: "EUR",
	total: "121,00",
	vatLines: [],
	category: "other",
	sourceQuote: "Total: 121,00 EUR",
	bodyMarkdown: "",
};

describe("normalizeAmountTokens", () => {
	it("reads es 1.234,56 and en 1,234.56 both as 123456 cents", () => {
		expect(normalizeAmountTokens("Total: 1.234,56").has(123456)).toBe(true);
		expect(normalizeAmountTokens("Total: 1,234.56").has(123456)).toBe(true);
	});

	it("reads a plain integer thousands group as units", () => {
		// "1.234" is a thousands group → 1234 units → 123400 cents (never 1.234 decimals).
		expect(normalizeAmountTokens("1.234").has(123400)).toBe(true);
	});

	it("reads short decimals in either locale", () => {
		expect(normalizeAmountTokens("49.99").has(4999)).toBe(true);
		expect(normalizeAmountTokens("49,99").has(4999)).toBe(true);
	});

	it("ignores non-money text", () => {
		expect(normalizeAmountTokens("sin importe alguno").size).toBe(0);
	});
});

describe("verifyBill — never-fabricate gate", () => {
	it("rejects a total that is absent from the source (fabricated)", () => {
		expect(verifyBill(billFrom(FABRICATED_TOTAL_REPLY))).toEqual({
			outcome: "reject",
			reason: "total_not_in_source",
		});
	});

	it("accepts a mixed-rate bill whose 21%+10% lines sum to the total", () => {
		expect(verifyBill(billFrom(VALID_REPLY, 0))).toEqual({
			outcome: "ok",
			verified: true,
		});
	});

	it("accepts a no-VAT bill whose total is quoted", () => {
		expect(verifyBill(billFrom(VALID_REPLY, 1))).toEqual({
			outcome: "ok",
			verified: true,
		});
	});

	it("rejects a single-line bill that is 2 cents off (tolerance 1)", () => {
		expect(verifyBill(billFrom(ARITHMETIC_MISMATCH_REPLY))).toEqual({
			outcome: "reject",
			reason: "arithmetic_mismatch",
		});
	});

	it("tolerates rounding within ±1 cent per VAT line", () => {
		// Two lines → 2 cents of Σ slack; each line's vat is within ±1c of its own 21% rate.
		// 60,00 + 12,61 + 40,00 + 8,41 = 121,02 vs total 121,00.
		const bill: AgentBill = {
			...BASE_BILL,
			vatLines: [
				{ ratePct: 21, base: "60,00", vat: "12,61" },
				{ ratePct: 21, base: "40,00", vat: "8,41" },
			],
			sourceQuote: "Total: 121,00 EUR",
			bodyMarkdown: "60,00 12,61 40,00 8,41",
		};
		expect(verifyBill(bill)).toEqual({ outcome: "ok", verified: true });
	});

	it("rejects a VAT line whose amount does not match its own declared rate", () => {
		// 10% of 100,00 is 10,00 — a "21%" label on that line is a misclassification.
		const bill: AgentBill = {
			...BASE_BILL,
			total: "110,00",
			vatLines: [{ ratePct: 21, base: "100,00", vat: "10,00" }],
			sourceQuote: "Total: 110,00 EUR",
			bodyMarkdown: "Base 100,00 IVA 10,00 Total 110,00",
		};
		expect(verifyBill(bill)).toEqual({
			outcome: "reject",
			reason: "arithmetic_mismatch",
		});
	});

	it("does not accept a bare integer from a date as the money total", () => {
		// "20" appears inside 2026-07-20 but nowhere as a money amount → fabricated total.
		const bill: AgentBill = {
			...BASE_BILL,
			vatLines: [],
			total: "20,00",
			sourceQuote: "Factura emitida el 2026-07-20",
			bodyMarkdown: "Gracias por su compra el 2026-07-20.",
		};
		expect(verifyBill(bill)).toEqual({
			outcome: "reject",
			reason: "total_not_in_source",
		});
	});

	it("accepts a bare integer as money when a currency marker sits next to it", () => {
		const bill: AgentBill = {
			...BASE_BILL,
			vatLines: [],
			total: "20",
			sourceQuote: "Total: 20 € — gracias",
			bodyMarkdown: "Total: 20 €",
		};
		expect(verifyBill(bill)).toEqual({ outcome: "ok", verified: true });
	});

	it("rejects when the deviation exceeds the per-line slack", () => {
		// Two lines → 2 cents of slack, but this is 3 cents off (121,03 vs 121,00).
		const bill: AgentBill = {
			...BASE_BILL,
			vatLines: [
				{ ratePct: 21, base: "60,00", vat: "12,60" },
				{ ratePct: 21, base: "40,00", vat: "8,43" },
			],
			sourceQuote: "Total: 121,00 EUR",
			bodyMarkdown: "60,00 12,60 40,00 8,43",
		};
		expect(verifyBill(bill)).toEqual({
			outcome: "reject",
			reason: "arithmetic_mismatch",
		});
	});

	it("passes arithmetic but flags verified=false when a VAT amount is not quoted", () => {
		// Total is quoted and the lines sum correctly, but the base/vat are not in the source text.
		const bill: AgentBill = {
			...BASE_BILL,
			total: "121,00",
			vatLines: [{ ratePct: 21, base: "100,00", vat: "21,00" }],
			sourceQuote: "Total: 121,00 EUR",
			bodyMarkdown: "Gracias por su compra.",
		};
		expect(verifyBill(bill)).toEqual({ outcome: "ok", verified: false });
	});
});
