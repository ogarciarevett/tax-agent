import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import type { NewBill } from "./ingest-repo";
import { createIngestRepo } from "./ingest-repo";
import { migrate } from "./migrations";

function bill(overrides: Partial<NewBill> = {}): NewBill {
	return {
		gmailMessageId: "msg-1",
		receivedDate: "2026-06-03",
		vendor: "Movistar",
		issueDate: "2026-06-01",
		currency: "EUR",
		totalCents: 6050,
		vatLines: [{ ratePct: 21, baseCents: 5000, vatCents: 1050 }],
		category: "telecom",
		filePath: "/tmp/x/2026-06/movistar-2026-06-01.md",
		sourceQuote: "Total factura: 60,50 €",
		extractor: "claude",
		verified: true,
		...overrides,
	};
}

describe("createIngestRepo", () => {
	let db: Database.Database;
	beforeEach(() => {
		db = new Database(":memory:");
		migrate(db);
	});

	it("round-trips a billed email through listBillsForMonth", () => {
		const repo = createIngestRepo(db);
		const id = repo.insertBilledEmail(bill());
		const [stored] = repo.listBillsForMonth("2026-06");
		expect(stored).toMatchObject({
			id,
			gmailMessageId: "msg-1",
			vendor: "Movistar",
			totalCents: 6050,
			vatLines: [{ ratePct: 21, baseCents: 5000, vatCents: 1050 }],
			verified: true,
		});
	});

	it("hasEmail dedupes by gmail message id across statuses", () => {
		const repo = createIngestRepo(db);
		expect(repo.hasEmail("msg-1")).toBe(false);
		repo.insertBilledEmail(bill());
		repo.insertEmail({
			gmailMessageId: "msg-2",
			receivedDate: "2026-06-04",
			status: "not_a_bill",
		});
		expect(repo.hasEmail("msg-1")).toBe(true);
		expect(repo.hasEmail("msg-2")).toBe(true);
	});

	it("rolls back the email row when the bill insert fails (atomicity)", () => {
		const repo = createIngestRepo(db);
		expect(
			() => repo.insertBilledEmail(bill({ totalCents: -1 })), // violates CHECK (total_cents >= 0)
		).toThrow();
		expect(repo.hasEmail("msg-1")).toBe(false);
	});

	it("rejects invalid vat_lines at the write boundary", () => {
		const repo = createIngestRepo(db);
		expect(() =>
			repo.insertBilledEmail(
				bill({
					vatLines: [{ ratePct: 21, baseCents: 50.5, vatCents: 1050 }],
				}),
			),
		).toThrow(); // non-integer cents
		expect(repo.hasEmail("msg-1")).toBe(false);
	});

	it("tracks the watermark as the max received date", () => {
		const repo = createIngestRepo(db);
		expect(repo.latestReceivedDate()).toBeNull();
		repo.insertBilledEmail(bill());
		repo.insertEmail({
			gmailMessageId: "msg-9",
			receivedDate: "2026-06-20",
			status: "not_a_bill",
		});
		expect(repo.latestReceivedDate()).toBe("2026-06-20");
	});

	it("groups by issue date with received-date fallback at month boundaries", () => {
		const repo = createIngestRepo(db);
		repo.insertBilledEmail(
			bill({ gmailMessageId: "jun", issueDate: "2026-06-30" }),
		);
		repo.insertBilledEmail(
			bill({ gmailMessageId: "jul", issueDate: "2026-07-01" }),
		);
		repo.insertBilledEmail(
			bill({
				gmailMessageId: "fallback",
				issueDate: null,
				receivedDate: "2026-07-15",
			}),
		);
		expect(
			repo.listBillsForMonth("2026-06").map((b) => b.gmailMessageId),
		).toEqual(["jun"]);
		expect(
			repo.listBillsForMonth("2026-07").map((b) => b.gmailMessageId),
		).toEqual(["jul", "fallback"]);
	});

	it("counts attachment-pending emails per month", () => {
		const repo = createIngestRepo(db);
		repo.insertEmail({
			gmailMessageId: "pend-1",
			receivedDate: "2026-06-10",
			status: "attachment_pending",
		});
		repo.insertEmail({
			gmailMessageId: "pend-2",
			receivedDate: "2026-07-10",
			status: "attachment_pending",
		});
		expect(repo.countAttachmentPendingForMonth("2026-06")).toBe(1);
		expect(repo.countAttachmentPendingForMonth("2026-07")).toBe(1);
		expect(repo.countAttachmentPendingForMonth("2026-08")).toBe(0);
	});
});

describe("listBillsForQuarterContaining", () => {
	it("computes the natural quarter months", async () => {
		const { monthsOfQuarterContaining } = await import("./ingest-repo");
		expect(monthsOfQuarterContaining("2026-07")).toEqual([
			"2026-07",
			"2026-08",
			"2026-09",
		]);
		expect(monthsOfQuarterContaining("2026-06")).toEqual([
			"2026-04",
			"2026-05",
			"2026-06",
		]);
	});

	it("returns the whole quarter while listBillsForMonth stays month-scoped", () => {
		const db = new Database(":memory:");
		migrate(db);
		const repo = createIngestRepo(db);
		repo.insertBilledEmail(
			bill({ gmailMessageId: "apr", issueDate: "2026-04-10" }),
		);
		repo.insertBilledEmail(
			bill({ gmailMessageId: "jun", issueDate: "2026-06-20" }),
		);
		repo.insertBilledEmail(
			bill({ gmailMessageId: "jul", issueDate: "2026-07-01" }),
		);
		expect(
			repo
				.listBillsForQuarterContaining("2026-06")
				.map((b) => b.gmailMessageId),
		).toEqual(["apr", "jun"]);
		expect(
			repo.listBillsForMonth("2026-06").map((b) => b.gmailMessageId),
		).toEqual(["jun"]);
	});
});
