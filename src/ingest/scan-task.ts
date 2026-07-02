import { ZodError } from "zod";
import {
	type AgentScanReport,
	BillCategorySchema,
	parseAgentScanReport,
} from "../domain/bill";

// The task prompt handed to the user's local agent CLI (`claude -p` / `codex exec`) once it has a
// Gmail tool. It never sends money off-device: the agent reads the user's own mailbox and replies
// with JSON only. The contract lives in src/domain/bill.ts — this file only phrases it.

const SEARCH_KEYWORDS = "factura OR invoice OR receipt OR recibo OR billing";
const BODY_MARKDOWN_CAP = 8000;

/** A compact, contract-shaped example so the agent copies the exact keys and value types. */
const EXAMPLE_REPORT: AgentScanReport = {
	bills: [
		{
			gmailMessageId: "18f0a1b2c3d4e5f6",
			receivedDate: "2026-06-30",
			vendor: "Acme SL",
			issueDate: "2026-06-29",
			currency: "EUR",
			total: "121,00",
			vatLines: [{ ratePct: 21, base: "100,00", vat: "21,00" }],
			category: "software",
			sourceQuote: "Total factura: 121,00 EUR",
			bodyMarkdown: "## Factura Acme SL\n\nTotal factura: 121,00 EUR",
		},
	],
	attachmentOnly: [
		{
			gmailMessageId: "18f0a1b2c3d4aaaa",
			receivedDate: "2026-06-28",
			vendor: "Endesa",
		},
	],
	notBills: ["18f0a1b2c3d4bbbb"],
	hasMore: false,
};

/**
 * Build the scan task prompt. `watermarkIso` is the newest email already ingested — the agent must
 * only look at mail received after it. `maxThreads` caps how many matching threads it opens.
 */
// ponytail: 8 threads/batch keeps one live claude batch under the CLI timeout; paging covers the rest.
export function buildScanPrompt(watermarkIso: string, maxThreads = 8): string {
	const categories = BillCategorySchema.options.join(", ");
	const example = JSON.stringify(EXAMPLE_REPORT, null, 2);
	return `You are a billing-email extractor with access to the user's own Gmail. Work ONLY inside
this mailbox and reply with a single JSON object — no prose, no markdown fences.

STEP 1 — search
- Query: ${SEARCH_KEYWORDS}
- Only threads received strictly AFTER ${watermarkIso}.
- Skip the Spam and Trash folders and skip mail the user sent themselves.
- Open at most ${maxThreads} matching threads, newest first.

STEP 2 — classify each thread as exactly one of:
- bill: the email body prints the amount(s) → add to "bills".
- attachment-only bill: it is a bill but the figures live only in an attachment you cannot open →
  add to "attachmentOnly" (id, receivedDate, vendor or null).
- not a bill → add its id to "notBills".

STEP 3 — for every bill, copy figures EXACTLY as printed:
- Never compute, never round, never guess. Copy the amount character-for-character as written
  (keep the original "1.234,56" or "1,234.56" formatting). Use null when a value is absent.
- "total" is the printed grand total. "vatLines" holds each VAT block as { ratePct, base, vat }.
- "sourceQuote" MUST be a verbatim snippet from the email that contains the total — it is the
  never-fabricate anchor; a total that is not quoted will be rejected.
- "bodyMarkdown": the email body converted to Markdown, capped at ~${BODY_MARKDOWN_CAP} characters.
- "currency" is the 3-letter ISO code. "category" is one of: ${categories}.
- Dates are YYYY-MM-DD. "issueDate" is the date printed on the bill (null if none).

STEP 4 — reply with ONLY this JSON shape. Set "hasMore" to true if more matching threads exist
beyond the ${maxThreads} you opened.

${example}`;
}

/** A parse either yields a validated report or a reason string safe to feed back to the agent. */
export type ParseAgentReplyResult =
	| { ok: true; report: AgentScanReport }
	| { ok: false; reason: string };

/**
 * Turn a raw agent reply into a validated report. Strips code fences, isolates the outermost JSON
 * object, JSON.parses it, then validates at the domain boundary. Never throws — a failure carries
 * the first issue (no PII, only the field path and message) so the retry prompt can quote it.
 */
export function parseAgentReply(raw: string): ParseAgentReplyResult {
	const jsonText = extractJsonObject(raw);
	if (jsonText === null) {
		return { ok: false, reason: "No JSON object found in the reply." };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch (error) {
		return {
			ok: false,
			reason: `Reply was not valid JSON: ${errorReason(error)}`,
		};
	}
	try {
		return { ok: true, report: parseAgentScanReport(parsed) };
	} catch (error) {
		return { ok: false, reason: errorReason(error) };
	}
}

/** Re-ask the agent after an invalid reply, quoting the reason so it can self-correct. */
export function buildRetryPrompt(
	originalPrompt: string,
	reason: string,
): string {
	return `${originalPrompt}

Your previous reply was invalid: ${reason}. Reply with ONLY valid JSON matching the shape.`;
}

function extractJsonObject(raw: string): string | null {
	const withoutFences = raw.replace(/```[a-zA-Z]*/g, "");
	const start = withoutFences.indexOf("{");
	const end = withoutFences.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		return null;
	}
	return withoutFences.slice(start, end + 1);
}

function errorReason(error: unknown): string {
	if (error instanceof ZodError) {
		const issue = error.issues[0];
		if (issue) {
			const path = issue.path.join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		}
		return "Invalid scan report.";
	}
	return error instanceof Error ? error.message : "Invalid scan report.";
}
