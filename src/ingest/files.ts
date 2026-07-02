import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentBill, AgentPendingAttachment } from "../domain/bill";

// Per-bill Markdown files under <root>/YYYY-MM/, kept private (dirs 0700, files 0600) because they
// hold personal financial data. Every file records its source quote so a number in a report can be
// traced back to the email it came from.

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const MAX_VENDOR_SLUG = 60;

/**
 * Write one verified bill as Markdown and return the absolute path. Month folder comes from the
 * issue date (falling back to the received date) — the same grouping the monthly report uses, so
 * the folder a bill lives in always matches the report month it appears under. Collisions get a
 * `-2`, `-3`, … suffix so a second bill from the same vendor on the same day never overwrites.
 */
export function writeBillFile(
	root: string,
	bill: AgentBill,
	extractor: string,
): string {
	const billDate = bill.issueDate ?? bill.receivedDate;
	const dir = ensureMonthDir(root, billDate);
	const base = `${sanitizeVendor(bill.vendor)}-${billDate}`;
	return writePrivateFile(dir, base, renderBill(bill, extractor));
}

/**
 * Write a stub for a bill whose figures live only in an attachment we could not open, flagged for
 * manual download. Same folder layout, perms, and collision handling as a real bill file.
 */
export function writePendingAttachmentFile(
	root: string,
	pending: AgentPendingAttachment,
): string {
	const dir = ensureMonthDir(root, pending.receivedDate);
	const vendorSlug = sanitizeVendor(pending.vendor ?? "adjunto");
	const base = `${vendorSlug}-${pending.receivedDate}-pendiente`;
	return writePrivateFile(dir, base, renderPending(pending));
}

function ensureMonthDir(root: string, isoDate: string): string {
	const dir = join(root, isoDate.slice(0, 7));
	mkdirSync(dir, { recursive: true, mode: DIR_MODE });
	chmodSync(dir, DIR_MODE);
	return dir;
}

function writePrivateFile(dir: string, base: string, contents: string): string {
	const filePath = resolveCollision(dir, base);
	writeFileSync(filePath, contents, { mode: FILE_MODE });
	chmodSync(filePath, FILE_MODE);
	return filePath;
}

function resolveCollision(dir: string, base: string): string {
	let candidate = join(dir, `${base}.md`);
	let n = 2;
	while (existsSync(candidate)) {
		candidate = join(dir, `${base}-${n}.md`);
		n += 1;
	}
	return candidate;
}

function renderBill(bill: AgentBill, extractor: string): string {
	const frontmatter = [
		"---",
		`gmailMessageId: ${yamlString(bill.gmailMessageId)}`,
		`extractor: ${yamlString(extractor)}`,
		`currency: ${yamlString(bill.currency)}`,
		`total: ${yamlString(bill.total)}`,
		`category: ${yamlString(bill.category)}`,
		"---",
	].join("\n");
	return `${frontmatter}\n\n${bill.bodyMarkdown}\n\n> Fuente: ${bill.sourceQuote}\n`;
}

function renderPending(pending: AgentPendingAttachment): string {
	const frontmatter = [
		"---",
		`gmailMessageId: ${yamlString(pending.gmailMessageId)}`,
		`vendor: ${yamlString(pending.vendor ?? "desconocido")}`,
		"status: attachment_pending",
		"---",
	].join("\n");
	return `${frontmatter}\n\nadjunto pendiente de descarga manual\n\nMensaje Gmail: ${pending.gmailMessageId}\n`;
}

/** Slugify a vendor for a filename: drop everything but word chars, dot, dash; lower-case; trim. */
function sanitizeVendor(vendor: string): string {
	const slug = vendor
		.replace(/[^\w.-]+/g, "-")
		.toLowerCase()
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_VENDOR_SLUG)
		.replace(/-+$/g, "");
	return slug.length > 0 ? slug : "sin-nombre";
}

/** Double-quote a value so ambiguous strings (numeric-looking totals, ids with ":") stay strings. */
function yamlString(value: string): string {
	return JSON.stringify(value);
}
