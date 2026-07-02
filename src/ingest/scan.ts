import type Database from "better-sqlite3";
import type { AgentRunner } from "../domain/agent";
import {
	type AgentBill,
	type AgentPendingAttachment,
	type AgentScanReport,
	toCents,
} from "../domain/bill";
import {
	createIngestRepo,
	type IngestRepo,
	type NewBill,
} from "../storage/ingest-repo";
import { loadProfile } from "../storage/profile-repo";
import { writeBillFile, writePendingAttachmentFile } from "./files";
import {
	buildRetryPrompt,
	buildScanPrompt,
	parseAgentReply,
} from "./scan-task";
import { verifyBill } from "./verify";

// The daily headless run: agent call → parse → verify → files → SQLite, idempotent. Everything is
// injected (db, agent, downloadsRoot, extractor, log, now) so the whole pipeline is unit-testable
// with a scripted fake agent and an in-memory DB — no CLI, no network. PII discipline: `log` only
// ever receives lines built from counts, gmail message ids, row ids, reason codes, and durations —
// never a vendor, subject, amount, prompt, or quote (see `toLine`).

// Re-scan a couple of days before the last seen mail so late-delivered invoices are not missed;
// the gmail-id dedupe makes the overlap free.
const OVERLAP_DAYS = 2;
// ponytail: cap the hasMore paging loop at 5 iterations — a single-user daily scan never needs
// more, and the cap stops a misbehaving agent from spinning forever.
const MAX_PAGING_ITERATIONS = 5;

export interface ScanSummary {
	readonly emailsSeen: number;
	readonly billsExtracted: number;
	readonly attachmentPending: number;
	readonly notBills: number;
	readonly failures: number;
}

/** PII-free log sink: receives a single formatted line (counts / ids / reason codes / durations). */
export type ScanLog = (line: string) => void;

export interface RunScanDeps {
	readonly db: Database.Database;
	readonly agent: AgentRunner;
	/** Root under which `<YYYY-MM>/<vendor>-<date>.md` files are written (e.g. ~/Downloads/tax-agent). */
	readonly downloadsRoot: string;
	/** Audit label of the extraction tool (e.g. "claude" / "codex:o4-mini"), stored on every row. */
	readonly extractor: string;
	readonly log: ScanLog;
	/** Injectable clock (durations). Defaults to `new Date`. */
	readonly now?: () => Date;
}

/** Fatal, pre-run failure (no profile). The CLI maps this to exit code 1 with the carried hint. */
export class ScanPreflightError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScanPreflightError";
	}
}

/** Exit-code contract for a completed run: 2 when any item failed, else 0. Fatal (1) is the CLI's. */
export function exitCodeForSummary(summary: ScanSummary): 0 | 2 {
	return summary.failures > 0 ? 2 : 0;
}

/** Window start for the scan: the newest mail already stored (minus overlap), else the tax-year start. */
export function computeWatermark(
	latest: string | null,
	taxYear: number,
): string {
	const base = latest ?? `${taxYear}-01-01`;
	const date = new Date(`${base}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() - OVERLAP_DAYS);
	return date.toISOString().slice(0, 10);
}

interface IngestContext {
	readonly repo: IngestRepo;
	readonly downloadsRoot: string;
	readonly extractor: string;
	readonly log: ScanLog;
}

interface Counts {
	emailsSeen: number;
	billsExtracted: number;
	attachmentPending: number;
	notBills: number;
	failures: number;
}

type ItemOutcome =
	| "bill"
	| "attachment"
	| "not_bill"
	| "reject"
	| "error"
	| "duplicate";

/**
 * Run one daily scan to completion and return its counts. Throws `ScanPreflightError` when no
 * profile exists; a missing CLI binary surfaces as the adapter's typed error (also fatal). Any
 * per-item error is caught and counted — one bad email never aborts the run.
 */
export async function runScan(deps: RunScanDeps): Promise<ScanSummary> {
	const { db, agent, downloadsRoot, extractor, log } = deps;
	const now = deps.now ?? (() => new Date());
	const startedAt = now();

	const profile = loadProfile(db);
	if (!profile) {
		throw new ScanPreflightError(
			"No profile found — run `tax-agent interview` first.",
		);
	}

	const repo = createIngestRepo(db);
	const ctx: IngestContext = { repo, downloadsRoot, extractor, log };
	const counts: Counts = {
		emailsSeen: 0,
		billsExtracted: 0,
		attachmentPending: 0,
		notBills: 0,
		failures: 0,
	};

	let watermark = computeWatermark(repo.latestReceivedDate(), profile.taxYear);
	log(toLine("start", { watermark, taxYear: profile.taxYear }));

	let hasMore = true;
	let iteration = 0;
	while (hasMore && iteration < MAX_PAGING_ITERATIONS) {
		iteration += 1;
		const report = await fetchReport(agent, buildScanPrompt(watermark), log);
		if (!report) {
			counts.failures += 1;
			log(toLine("batch_unparsed", { iteration }));
			break;
		}
		ingestBatch(ctx, report, watermark, counts);
		hasMore = report.hasMore;
		if (hasMore) {
			const newest = newestInReport(report);
			if (newest === null || newest <= watermark) {
				log(toLine("paging_stopped", { iteration }));
				break;
			}
			watermark = newest;
		}
	}

	const summary: ScanSummary = { ...counts };
	log(
		toLine("done", {
			...summary,
			durationMs: now().getTime() - startedAt.getTime(),
		}),
	);
	return summary;
}

/** One agent turn with a single retry on a parse failure. Returns null when both replies are invalid. */
async function fetchReport(
	agent: AgentRunner,
	prompt: string,
	log: ScanLog,
): Promise<AgentScanReport | null> {
	const first = parseAgentReply(await agent.run(prompt));
	if (first.ok) {
		return first.report;
	}
	// The precise zod reason guides the AGENT (in the retry prompt); the log gets only a coarse code.
	log(toLine("retry", { reason: "parse_invalid" }));
	const retry = parseAgentReply(
		await agent.run(buildRetryPrompt(prompt, first.reason)),
	);
	return retry.ok ? retry.report : null;
}

function ingestBatch(
	ctx: IngestContext,
	report: AgentScanReport,
	watermark: string,
	counts: Counts,
): void {
	for (const bill of report.bills) {
		applyOutcome(counts, ingestBill(ctx, bill));
	}
	for (const pending of report.attachmentOnly) {
		applyOutcome(counts, ingestPending(ctx, pending));
	}
	for (const id of report.notBills) {
		applyOutcome(counts, ingestNotBill(ctx, id, watermark));
	}
}

function applyOutcome(counts: Counts, outcome: ItemOutcome): void {
	if (outcome === "duplicate") {
		return;
	}
	counts.emailsSeen += 1;
	if (outcome === "bill") {
		counts.billsExtracted += 1;
	} else if (outcome === "attachment") {
		counts.attachmentPending += 1;
	} else if (outcome === "not_bill") {
		counts.notBills += 1;
	} else {
		counts.failures += 1;
	}
}

function ingestBill(ctx: IngestContext, bill: AgentBill): ItemOutcome {
	if (ctx.repo.hasEmail(bill.gmailMessageId)) {
		return "duplicate";
	}
	const verdict = verifyBill(bill);
	if (verdict.outcome === "reject") {
		ctx.repo.insertEmail({
			gmailMessageId: bill.gmailMessageId,
			receivedDate: bill.receivedDate,
			status: "failed",
			errorCode: verdict.reason,
		});
		ctx.log(
			toLine("bill_rejected", {
				id: bill.gmailMessageId,
				reason: verdict.reason,
			}),
		);
		return "reject";
	}
	try {
		const filePath = writeBillFile(ctx.downloadsRoot, bill, ctx.extractor);
		const billId = ctx.repo.insertBilledEmail(
			toNewBill(bill, filePath, ctx.extractor, verdict.verified),
		);
		ctx.log(
			toLine("bill_stored", {
				id: bill.gmailMessageId,
				billId,
				verified: verdict.verified ? 1 : 0,
			}),
		);
		return "bill";
	} catch (error) {
		ctx.log(
			toLine("bill_error", {
				id: bill.gmailMessageId,
				code: safeErrorCode(error),
			}),
		);
		return "error";
	}
}

function ingestPending(
	ctx: IngestContext,
	pending: AgentPendingAttachment,
): ItemOutcome {
	if (ctx.repo.hasEmail(pending.gmailMessageId)) {
		return "duplicate";
	}
	try {
		writePendingAttachmentFile(ctx.downloadsRoot, pending);
		ctx.repo.insertEmail({
			gmailMessageId: pending.gmailMessageId,
			receivedDate: pending.receivedDate,
			status: "attachment_pending",
		});
		ctx.log(toLine("attachment_pending", { id: pending.gmailMessageId }));
		return "attachment";
	} catch (error) {
		ctx.log(
			toLine("attachment_error", {
				id: pending.gmailMessageId,
				code: safeErrorCode(error),
			}),
		);
		return "error";
	}
}

function ingestNotBill(
	ctx: IngestContext,
	gmailMessageId: string,
	watermark: string,
): ItemOutcome {
	if (ctx.repo.hasEmail(gmailMessageId)) {
		return "duplicate";
	}
	// notBills carry no date in the contract — store at the watermark so they never advance it.
	ctx.repo.insertEmail({
		gmailMessageId,
		receivedDate: watermark,
		status: "not_a_bill",
	});
	ctx.log(toLine("not_bill", { id: gmailMessageId }));
	return "not_bill";
}

function toNewBill(
	bill: AgentBill,
	filePath: string,
	extractor: string,
	verified: boolean,
): NewBill {
	return {
		gmailMessageId: bill.gmailMessageId,
		receivedDate: bill.receivedDate,
		vendor: bill.vendor,
		issueDate: bill.issueDate,
		currency: bill.currency,
		totalCents: toCents(bill.total),
		vatLines: bill.vatLines.map((line) => ({
			ratePct: line.ratePct,
			baseCents: toCents(line.base),
			vatCents: toCents(line.vat),
		})),
		category: bill.category,
		filePath,
		sourceQuote: bill.sourceQuote,
		extractor,
		verified,
	};
}

/** Newest received date across the datable items of a report — the next paging window's start. */
function newestInReport(report: AgentScanReport): string | null {
	const dates = [
		...report.bills.map((bill) => bill.receivedDate),
		...report.attachmentOnly.map((pending) => pending.receivedDate),
	];
	return dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Extract a non-PII error code — never the message, which can embed a vendor-named file path. */
function safeErrorCode(error: unknown): string {
	if (error && typeof error === "object" && "code" in error) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === "string") {
			return code;
		}
	}
	return error instanceof Error ? error.name : "unknown";
}

/** Build one PII-free log line: `scan <event> k=v k=v`. Only ids/counts/codes/durations go in. */
function toLine(
	event: string,
	fields: Record<string, string | number> = {},
): string {
	const parts = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
	return parts.length > 0
		? `scan ${event} ${parts.join(" ")}`
		: `scan ${event}`;
}
