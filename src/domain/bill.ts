import { z } from "zod";

// Expense categories the agent classifies bills into. The es module maps each to a deductible
// share — keep this enum and that map in sync when adding a category.
export const BillCategorySchema = z.enum([
	"software",
	"telecom",
	"utilities",
	"office_supplies",
	"professional_services",
	"travel",
	"meals",
	"hardware",
	"rent",
	"other",
]);
export type BillCategory = z.infer<typeof BillCategorySchema>;

/**
 * Parse an amount EXACTLY as printed in a document — the agent copies, this code converts.
 * Accepts "1234", "123,45", "123.45", es "1.234,56", en "1,234.56", and integer thousands
 * ("1.234" → 1234 units). Returns integer cents, or null when the string is not a money shape.
 * Money is never represented as a float anywhere in this codebase.
 */
export function parsePrintedAmountCents(printed: string): number | null {
	const s = printed.trim();
	if (!/^\d(?:[\d.,]*\d)?$/.test(s)) {
		return null;
	}
	const lastSepIdx = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
	let whole = s;
	let frac = "";
	let decimalSep = "";
	if (lastSepIdx !== -1) {
		const digitsAfter = s.length - lastSepIdx - 1;
		if (digitsAfter === 1 || digitsAfter === 2) {
			whole = s.slice(0, lastSepIdx);
			frac = s.slice(lastSepIdx + 1);
			decimalSep = s[lastSepIdx] as string;
		} else if (digitsAfter !== 3) {
			// A trailing group of 3 is a thousands separator ("1.234"); anything else is malformed.
			return null;
		}
	}
	if (!/^\d+$/.test(whole)) {
		// Grouped form: 1-3 leading digits then same-separator groups of exactly 3, and the
		// grouping character must differ from the decimal one ("1.234,56" ok, "1.234.5" not).
		if (!/^\d{1,3}(?:[.,]\d{3})+$/.test(whole)) {
			return null;
		}
		const groupSeps = new Set(whole.replace(/\d/g, ""));
		if (groupSeps.size > 1 || groupSeps.has(decimalSep)) {
			return null;
		}
	}
	const units = Number(whole.replace(/[.,]/g, ""));
	if (!Number.isSafeInteger(units) || units > 99_999_999) {
		return null;
	}
	const cents =
		frac.length === 0
			? 0
			: frac.length === 1
				? Number(frac) * 10
				: Number(frac);
	return units * 100 + cents;
}

/** Like parsePrintedAmountCents but throws — for values already validated by the schema. */
export function toCents(printed: string): number {
	const cents = parsePrintedAmountCents(printed);
	if (cents === null) {
		throw new Error("Not a printed money amount.");
	}
	return cents;
}

export const PrintedAmountSchema = z
	.string()
	.max(20)
	.refine((s) => parsePrintedAmountCents(s) !== null, {
		message: 'Expected an amount as printed, e.g. "123,45" or "1.234,56".',
	});

const IsoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD.");
// Real Gmail ids are hex, but agent output is untrusted: the charset bound keeps a hostile id
// from forging audit-log lines or injecting file content.
const GmailIdSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[A-Za-z0-9_-]+$/, "Expected a Gmail message id.");

// ---- The agent JSON contract (what `claude -p` / `codex exec` must reply with) ----

export const AgentVatLineSchema = z.object({
	ratePct: z.number().min(0).max(30),
	base: PrintedAmountSchema,
	vat: PrintedAmountSchema,
});

/** A bill whose amounts the agent found printed in the email body text. */
export const AgentBillSchema = z.object({
	gmailMessageId: GmailIdSchema,
	receivedDate: IsoDateSchema,
	vendor: z.string().min(1).max(200),
	issueDate: IsoDateSchema.nullable(),
	currency: z.string().length(3),
	total: PrintedAmountSchema,
	vatLines: z.array(AgentVatLineSchema).max(10),
	category: BillCategorySchema,
	// Verbatim snippet from the email containing the total — the never-fabricate anchor.
	sourceQuote: z.string().min(1).max(2000),
	bodyMarkdown: z.string().max(20000),
});
export type AgentBill = z.infer<typeof AgentBillSchema>;

/** A billing email whose figures live ONLY in an attachment the agent cannot open. */
export const AgentPendingAttachmentSchema = z.object({
	gmailMessageId: GmailIdSchema,
	receivedDate: IsoDateSchema,
	vendor: z.string().min(1).max(200).nullable(),
});
export type AgentPendingAttachment = z.infer<
	typeof AgentPendingAttachmentSchema
>;

export const AgentScanReportSchema = z.object({
	bills: z.array(AgentBillSchema).max(100),
	attachmentOnly: z.array(AgentPendingAttachmentSchema).max(100),
	notBills: z.array(GmailIdSchema).max(500),
	hasMore: z.boolean(),
});
export type AgentScanReport = z.infer<typeof AgentScanReportSchema>;

/** Validate an untrusted agent reply at the boundary. Throws ZodError on invalid data. */
export function parseAgentScanReport(raw: unknown): AgentScanReport {
	return AgentScanReportSchema.parse(raw);
}

// ---- The stored shape (SQLite; money as integer cents) ----

export const VatLineCentsSchema = z.object({
	ratePct: z.number().min(0).max(30),
	baseCents: z.number().int().nonnegative(),
	vatCents: z.number().int().nonnegative(),
});
export type VatLineCents = z.infer<typeof VatLineCentsSchema>;
export const VatLinesCentsSchema = z.array(VatLineCentsSchema).max(10);

export interface BillRecord {
	readonly id: number;
	readonly emailId: number;
	readonly gmailMessageId: string;
	readonly vendor: string;
	/** Date printed on the bill; falls back to receivedDate for month grouping when null. */
	readonly issueDate: string | null;
	readonly receivedDate: string;
	readonly currency: string;
	readonly totalCents: number;
	readonly vatLines: readonly VatLineCents[];
	readonly category: BillCategory;
	readonly filePath: string;
	readonly sourceQuote: string;
	readonly extractor: string;
	readonly verified: boolean;
	readonly extractedAt: string;
}
