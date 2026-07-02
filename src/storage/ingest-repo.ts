import type Database from "better-sqlite3";
import {
	type BillCategory,
	BillCategorySchema,
	type BillRecord,
	type VatLineCents,
	VatLinesCentsSchema,
} from "../domain/bill";

export type EmailStatus =
	| "billed"
	| "attachment_pending"
	| "not_a_bill"
	| "failed";

export interface NewEmail {
	readonly gmailMessageId: string;
	readonly receivedDate: string;
	readonly status: Exclude<EmailStatus, "billed">;
	readonly errorCode?: string;
}

export interface NewBill {
	readonly gmailMessageId: string;
	readonly receivedDate: string;
	readonly vendor: string;
	readonly issueDate: string | null;
	readonly currency: string;
	readonly totalCents: number;
	readonly vatLines: readonly VatLineCents[];
	readonly category: BillCategory;
	readonly filePath: string;
	readonly sourceQuote: string;
	readonly extractor: string;
	readonly verified: boolean;
}

export interface IngestRepo {
	hasEmail(gmailMessageId: string): boolean;
	/** Insert the email row + its bill row atomically. Returns the bill id. */
	insertBilledEmail(bill: NewBill): number;
	/** Insert a bill-less email row (attachment_pending / not_a_bill / failed). */
	insertEmail(email: NewEmail): number;
	/** Newest received_date seen — the scan watermark. Null on first run. */
	latestReceivedDate(): string | null;
	/** Bills whose issue date (fallback: received date) falls in the YYYY-MM month. */
	listBillsForMonth(month: string): BillRecord[];
	/** Bills of the whole natural quarter containing `month` — feeds the Modelo 303/130 figures. */
	listBillsForQuarterContaining(month: string): BillRecord[];
	countAttachmentPendingForMonth(month: string): number;
}

/** The three YYYY-MM months of the natural quarter containing `month`. */
export function monthsOfQuarterContaining(
	month: string,
): [string, string, string] {
	const year = month.slice(0, 5); // "YYYY-"
	const firstMonth = Math.floor((Number(month.slice(5, 7)) - 1) / 3) * 3 + 1;
	const mm = (n: number): string => `${year}${String(n).padStart(2, "0")}`;
	return [mm(firstMonth), mm(firstMonth + 1), mm(firstMonth + 2)];
}

interface BillRow {
	id: number;
	email_id: number;
	gmail_message_id: string;
	vendor: string;
	issue_date: string | null;
	received_date: string;
	currency: string;
	total_cents: number;
	vat_lines: string;
	category: string;
	file_path: string;
	source_quote: string;
	extractor: string;
	verified: number;
	extracted_at: string;
}

/** Statements are prepared once here (deferred debt from .ai/specs/03-review.md). */
export function createIngestRepo(db: Database.Database): IngestRepo {
	const selectEmail = db.prepare(
		"SELECT 1 FROM emails WHERE gmail_message_id = ?",
	);
	const insertEmailStmt = db.prepare(
		`INSERT INTO emails (gmail_message_id, received_date, status, error_code, created_at)
     VALUES (@gmailMessageId, @receivedDate, @status, @errorCode, @createdAt)`,
	);
	const insertBillStmt = db.prepare(
		`INSERT INTO bills (email_id, vendor, issue_date, currency, total_cents, vat_lines,
                        category, file_path, source_quote, extractor, verified, extracted_at)
     VALUES (@emailId, @vendor, @issueDate, @currency, @totalCents, @vatLines,
             @category, @filePath, @sourceQuote, @extractor, @verified, @extractedAt)`,
	);
	const selectLatest = db.prepare(
		"SELECT MAX(received_date) AS latest FROM emails",
	);
	const selectMonth = db.prepare(
		`SELECT b.*, e.gmail_message_id, e.received_date FROM bills b
     JOIN emails e ON e.id = b.email_id
     WHERE substr(COALESCE(b.issue_date, e.received_date), 1, 7) = ?
     ORDER BY COALESCE(b.issue_date, e.received_date), b.id`,
	);
	const selectQuarter = db.prepare(
		`SELECT b.*, e.gmail_message_id, e.received_date FROM bills b
     JOIN emails e ON e.id = b.email_id
     WHERE substr(COALESCE(b.issue_date, e.received_date), 1, 7) IN (?, ?, ?)
     ORDER BY COALESCE(b.issue_date, e.received_date), b.id`,
	);
	const countPendingMonth = db.prepare(
		`SELECT COUNT(*) AS n FROM emails
     WHERE status = 'attachment_pending' AND substr(received_date, 1, 7) = ?`,
	);

	const insertBilledTxn = db.transaction((bill: NewBill): number => {
		const emailResult = insertEmailStmt.run({
			gmailMessageId: bill.gmailMessageId,
			receivedDate: bill.receivedDate,
			status: "billed",
			errorCode: null,
			createdAt: new Date().toISOString(),
		});
		const result = insertBillStmt.run({
			emailId: emailResult.lastInsertRowid,
			vendor: bill.vendor,
			issueDate: bill.issueDate,
			currency: bill.currency,
			totalCents: bill.totalCents,
			vatLines: JSON.stringify(VatLinesCentsSchema.parse(bill.vatLines)),
			category: bill.category,
			filePath: bill.filePath,
			sourceQuote: bill.sourceQuote,
			extractor: bill.extractor,
			verified: bill.verified ? 1 : 0,
			extractedAt: new Date().toISOString(),
		});
		return Number(result.lastInsertRowid);
	});

	return {
		hasEmail(gmailMessageId) {
			return selectEmail.get(gmailMessageId) !== undefined;
		},
		insertBilledEmail(bill) {
			return insertBilledTxn(bill);
		},
		insertEmail(email) {
			const result = insertEmailStmt.run({
				gmailMessageId: email.gmailMessageId,
				receivedDate: email.receivedDate,
				status: email.status,
				errorCode: email.errorCode ?? null,
				createdAt: new Date().toISOString(),
			});
			return Number(result.lastInsertRowid);
		},
		latestReceivedDate() {
			const row = selectLatest.get() as { latest: string | null };
			return row.latest;
		},
		listBillsForMonth(month) {
			const rows = selectMonth.all(month) as BillRow[];
			return rows.map(toBillRecord);
		},
		listBillsForQuarterContaining(month) {
			const rows = selectQuarter.all(
				...monthsOfQuarterContaining(month),
			) as BillRow[];
			return rows.map(toBillRecord);
		},
		countAttachmentPendingForMonth(month) {
			const row = countPendingMonth.get(month) as { n: number };
			return row.n;
		},
	};
}

/** Re-validate at the read boundary (same policy as profile-repo). */
function toBillRecord(row: BillRow): BillRecord {
	return {
		id: row.id,
		emailId: row.email_id,
		gmailMessageId: row.gmail_message_id,
		vendor: row.vendor,
		issueDate: row.issue_date,
		receivedDate: row.received_date,
		currency: row.currency,
		totalCents: row.total_cents,
		vatLines: VatLinesCentsSchema.parse(JSON.parse(row.vat_lines)),
		category: BillCategorySchema.parse(row.category),
		filePath: row.file_path,
		sourceQuote: row.source_quote,
		extractor: row.extractor,
		verified: row.verified === 1,
		extractedAt: row.extracted_at,
	};
}
