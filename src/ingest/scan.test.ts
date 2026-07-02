import {
	existsSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentRunner } from "../domain/agent";
import type { AgentBill } from "../domain/bill";
import type { Profile } from "../domain/profile";
import { openDb } from "../storage/db";
import { saveProfile } from "../storage/profile-repo";
import {
	ARITHMETIC_MISMATCH_REPLY,
	FABRICATED_TOTAL_REPLY,
	INVALID_REPLY,
	VALID_REPLY,
} from "./fixtures";
import {
	computeWatermark,
	exitCodeForSummary,
	type RunScanDeps,
	runScan,
	type ScanLog,
	ScanPreflightError,
	type ScanSummary,
} from "./scan";

const PROFILE: Profile = {
	id: "me",
	country: "es",
	residency: "resident",
	taxYear: 2026,
	filingSituation: "self_employed",
	fullName: "Omar G",
	taxId: "12345678Z",
};

const FIXED_NOW = new Date("2026-07-02T09:00:00.000Z");

/** A fake agent that returns scripted replies in order and rejects once exhausted (loop guard). */
function scriptedAgent(replies: readonly string[]): {
	agent: AgentRunner;
	callCount: () => number;
} {
	let i = 0;
	return {
		agent: {
			run(_prompt: string): Promise<string> {
				if (i >= replies.length) {
					return Promise.reject(new Error("no more scripted replies"));
				}
				const reply = replies[i] as string;
				i += 1;
				return Promise.resolve(reply);
			},
		},
		callCount: () => i,
	};
}

function captureLog(): { log: ScanLog; lines: string[] } {
	const lines: string[] = [];
	return {
		log: (line) => {
			lines.push(line);
		},
		lines,
	};
}

/** A one-bill report reply whose total is present in its own quote (so it verifies). */
function billReply(
	id: string,
	receivedDate: string,
	total: string,
	hasMore: boolean,
): string {
	const bill: AgentBill = {
		gmailMessageId: id,
		receivedDate,
		vendor: "Vendor",
		issueDate: null,
		currency: "EUR",
		total,
		vatLines: [],
		category: "other",
		sourceQuote: `Total ${total} EUR`,
		bodyMarkdown: "",
	};
	return JSON.stringify({
		bills: [bill],
		attachmentOnly: [],
		notBills: [],
		hasMore,
	});
}

let db: Database.Database;
let downloadsRoot: string;

beforeEach(() => {
	db = openDb(":memory:");
	downloadsRoot = mkdtempSync(join(tmpdir(), "tax-agent-scan-"));
});

afterEach(() => {
	db.close();
	rmSync(downloadsRoot, { recursive: true, force: true });
});

function deps(agent: AgentRunner, log: ScanLog): RunScanDeps {
	return {
		db,
		agent,
		downloadsRoot,
		extractor: "test",
		log,
		now: () => FIXED_NOW,
	};
}

const countEmails = (): number =>
	(db.prepare("SELECT COUNT(*) AS n FROM emails").get() as { n: number }).n;
const countBills = (): number =>
	(db.prepare("SELECT COUNT(*) AS n FROM bills").get() as { n: number }).n;
const mdFiles = (): string[] =>
	existsSync(join(downloadsRoot, "2026-06"))
		? readdirSync(join(downloadsRoot, "2026-06"))
		: [];

describe("computeWatermark", () => {
	it("falls back to the tax-year start minus the overlap when the DB is empty", () => {
		expect(computeWatermark(null, 2026)).toBe("2025-12-30");
	});

	it("subtracts the overlap from the newest stored date", () => {
		expect(computeWatermark("2026-06-18", 2026)).toBe("2026-06-16");
	});
});

describe("exitCodeForSummary", () => {
	const base: ScanSummary = {
		emailsSeen: 3,
		billsExtracted: 2,
		attachmentPending: 1,
		notBills: 0,
		failures: 0,
	};
	it("returns 0 for a clean run", () => {
		expect(exitCodeForSummary(base)).toBe(0);
	});
	it("returns 2 when any item failed", () => {
		expect(exitCodeForSummary({ ...base, failures: 1 })).toBe(2);
	});
});

describe("runScan preflight", () => {
	it("throws ScanPreflightError when no profile exists", async () => {
		const { agent } = scriptedAgent([VALID_REPLY]);
		const { log } = captureLog();
		await expect(runScan(deps(agent, log))).rejects.toBeInstanceOf(
			ScanPreflightError,
		);
	});
});

describe("runScan — fake-driven run", () => {
	beforeEach(() => saveProfile(db, PROFILE));

	it("extracts bills, stubs attachments, records not-bills, and writes files", async () => {
		const { agent } = scriptedAgent([VALID_REPLY]);
		const { log } = captureLog();

		const summary = await runScan(deps(agent, log));

		expect(summary).toEqual({
			emailsSeen: 4,
			billsExtracted: 2,
			attachmentPending: 1,
			notBills: 1,
			failures: 0,
		});
		expect(countEmails()).toBe(4);
		expect(countBills()).toBe(2);
		expect(mdFiles().sort()).toEqual([
			"acme-sl-2026-06-15.md",
			"endesa-2026-06-19-pendiente.md",
			"globex-inc-2026-06-20.md",
		]);
		const billPath = join(downloadsRoot, "2026-06", "acme-sl-2026-06-15.md");
		expect(statSync(billPath).mode & 0o777).toBe(0o600);
		expect(statSync(join(downloadsRoot, "2026-06")).mode & 0o777).toBe(0o700);
	});

	it("is idempotent: a second identical run adds no rows or files", async () => {
		await runScan(deps(scriptedAgent([VALID_REPLY]).agent, captureLog().log));
		const emailsAfterFirst = countEmails();
		const filesAfterFirst = mdFiles().length;

		const summary = await runScan(
			deps(scriptedAgent([VALID_REPLY]).agent, captureLog().log),
		);

		expect(summary).toEqual({
			emailsSeen: 0,
			billsExtracted: 0,
			attachmentPending: 0,
			notBills: 0,
			failures: 0,
		});
		expect(countEmails()).toBe(emailsAfterFirst);
		expect(mdFiles().length).toBe(filesAfterFirst);
	});

	it("logs no vendor, subject, or amount strings", async () => {
		const { log, lines } = captureLog();
		await runScan(deps(scriptedAgent([VALID_REPLY]).agent, log));
		const dump = lines.join("\n");
		for (const pii of [
			"Acme SL",
			"Globex Inc",
			"Endesa",
			"1.234,56",
			"49.99",
		]) {
			expect(dump).not.toContain(pii);
		}
	});
});

describe("runScan — retry path", () => {
	beforeEach(() => saveProfile(db, PROFILE));

	it("recovers on a valid retry after one invalid reply", async () => {
		const { agent, callCount } = scriptedAgent([INVALID_REPLY, VALID_REPLY]);
		const { log, lines } = captureLog();

		const summary = await runScan(deps(agent, log));

		expect(summary.billsExtracted).toBe(2);
		expect(summary.failures).toBe(0);
		expect(callCount()).toBe(2);
		expect(lines.some((l) => l.includes("scan retry"))).toBe(true);
	});

	it("counts a failure and maps to exit 2 when both replies are invalid", async () => {
		const { agent, callCount } = scriptedAgent([INVALID_REPLY, INVALID_REPLY]);
		const { log } = captureLog();

		const summary = await runScan(deps(agent, log));

		expect(summary.failures).toBe(1);
		expect(summary.emailsSeen).toBe(0);
		expect(callCount()).toBe(2);
		expect(exitCodeForSummary(summary)).toBe(2);
	});
});

describe("runScan — verification rejections", () => {
	beforeEach(() => saveProfile(db, PROFILE));

	it("rejects a fabricated total and records a failed email", async () => {
		const { log, lines } = captureLog();
		const summary = await runScan(
			deps(scriptedAgent([FABRICATED_TOTAL_REPLY]).agent, log),
		);

		expect(summary).toMatchObject({ billsExtracted: 0, failures: 1 });
		expect(countBills()).toBe(0);
		const row = db.prepare("SELECT status, error_code FROM emails").get() as {
			status: string;
			error_code: string;
		};
		expect(row).toEqual({
			status: "failed",
			error_code: "total_not_in_source",
		});
		expect(
			lines.some(
				(l) =>
					l.includes("bill_rejected") &&
					l.includes("reason=total_not_in_source"),
			),
		).toBe(true);
	});

	it("rejects an arithmetic mismatch", async () => {
		const { log } = captureLog();
		const summary = await runScan(
			deps(scriptedAgent([ARITHMETIC_MISMATCH_REPLY]).agent, log),
		);

		expect(summary).toMatchObject({ billsExtracted: 0, failures: 1 });
		const row = db.prepare("SELECT error_code FROM emails").get() as {
			error_code: string;
		};
		expect(row.error_code).toBe("arithmetic_mismatch");
	});
});

describe("runScan — resilience", () => {
	beforeEach(() => saveProfile(db, PROFILE));

	it("counts a write failure as a failure without aborting the run", async () => {
		// Block the month dir by planting a FILE where writeBillFile needs a directory.
		writeFileSync(join(downloadsRoot, "2026-06"), "blocker");
		const { log, lines } = captureLog();

		const summary = await runScan(
			deps(
				scriptedAgent([billReply("werr", "2026-06-18", "5,00", false)]).agent,
				log,
			),
		);

		expect(summary).toMatchObject({ billsExtracted: 0, failures: 1 });
		expect(countBills()).toBe(0);
		expect(lines.some((l) => l.includes("bill_error"))).toBe(true);
	});
});

describe("runScan — hasMore paging", () => {
	beforeEach(() => saveProfile(db, PROFILE));

	it("advances the watermark and pages until hasMore is false", async () => {
		const { agent, callCount } = scriptedAgent([
			billReply("p1", "2026-03-01", "5,00", true),
			billReply("p2", "2026-03-05", "6,00", false),
		]);
		const { log } = captureLog();

		const summary = await runScan(deps(agent, log));

		expect(summary.billsExtracted).toBe(2);
		expect(callCount()).toBe(2);
	});

	it("stops paging when the batch carries no advanceable date", async () => {
		const notBillsOnly = JSON.stringify({
			bills: [],
			attachmentOnly: [],
			notBills: ["n1"],
			hasMore: true,
		});
		const { agent, callCount } = scriptedAgent([notBillsOnly]);
		const { log, lines } = captureLog();

		const summary = await runScan(deps(agent, log));

		expect(summary.notBills).toBe(1);
		expect(callCount()).toBe(1);
		expect(lines.some((l) => l.includes("paging_stopped"))).toBe(true);
	});
});
