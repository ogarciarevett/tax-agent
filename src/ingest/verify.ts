import {
	type AgentBill,
	parsePrintedAmountCents,
	toCents,
} from "../domain/bill";

// The never-fabricate gate. It trusts nothing the agent computed: it only accepts figures that
// appear verbatim in the email text, and it re-checks the VAT arithmetic itself. Money is integer
// cents throughout — parsing goes through the frozen domain helpers, never parseFloat.

// Bare integers ("20") also appear in dates, quantities, and VAT rates — a currency marker within
// a few characters is what makes one a money amount. Separator forms ("60,50") count everywhere.
const CURRENCY_NEARBY = /€|\$|£|\b(?:eur|usd|gbp)\b/i;

/**
 * Every cents value that the money-shaped tokens in `text` could legitimately read as. Each token
 * is parsed as printed AND with its "." / "," separators swapped, so a Spanish "1.234,56" and an
 * English "1,234.56" in the source both cover 123456 cents regardless of the writer's locale.
 */
export function normalizeAmountTokens(text: string): Set<number> {
	const cents = new Set<number>();
	for (const match of text.matchAll(/\d[\d.,]*\d|\d/g)) {
		const token = match[0];
		if (!/[.,]/.test(token)) {
			const context = text.slice(
				Math.max(0, match.index - 4),
				match.index + token.length + 5,
			);
			if (!CURRENCY_NEARBY.test(context)) {
				continue;
			}
		}
		addReading(cents, token);
		addReading(cents, swapSeparators(token));
	}
	return cents;
}

export type VerifyResult =
	| { outcome: "ok"; verified: boolean }
	| {
			outcome: "reject";
			reason: "total_not_in_source" | "arithmetic_mismatch";
	  };

/**
 * Verify one extracted bill against its own quoted source text:
 * 1. the total must appear in sourceQuote+bodyMarkdown, else reject `total_not_in_source`;
 * 2. Σbase+Σvat must equal the total within ±1 cent per VAT line (per-line rounding slack), else
 *    reject `arithmetic_mismatch`;
 * 3. `verified` is true only when every base and vat amount is also found in the source text.
 */
export function verifyBill(bill: AgentBill): VerifyResult {
	const tokens = normalizeAmountTokens(
		`${bill.sourceQuote}\n${bill.bodyMarkdown}`,
	);
	const totalCents = toCents(bill.total);
	if (!tokens.has(totalCents)) {
		return { outcome: "reject", reason: "total_not_in_source" };
	}
	if (bill.vatLines.length > 0) {
		let sum = 0;
		for (const line of bill.vatLines) {
			const base = toCents(line.base);
			const vat = toCents(line.vat);
			sum += base + vat;
			// Each line's vat must also match its own declared rate (±1c rounding) — a mislabeled
			// rate would silently misroute the per-rate IVA figures.
			if (Math.abs(vat - Math.round((base * line.ratePct) / 100)) > 1) {
				return { outcome: "reject", reason: "arithmetic_mismatch" };
			}
		}
		const tolerance = bill.vatLines.length;
		if (Math.abs(sum - totalCents) > tolerance) {
			return { outcome: "reject", reason: "arithmetic_mismatch" };
		}
	}
	const verified = bill.vatLines.every(
		(line) => tokens.has(toCents(line.base)) && tokens.has(toCents(line.vat)),
	);
	return { outcome: "ok", verified };
}

function addReading(cents: Set<number>, token: string): void {
	const value = parsePrintedAmountCents(token);
	if (value !== null) {
		cents.add(value);
	}
}

function swapSeparators(token: string): string {
	return token.replace(/[.,]/g, (ch) => (ch === "," ? "." : ","));
}
