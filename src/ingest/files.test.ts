import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentBill, AgentPendingAttachment } from "../domain/bill";
import { writeBillFile, writePendingAttachmentFile } from "./files";

const bill: AgentBill = {
	gmailMessageId: "msg-acme-01",
	receivedDate: "2026-06-18",
	vendor: "Acme SL",
	issueDate: "2026-06-15",
	currency: "EUR",
	total: "1.234,56",
	vatLines: [{ ratePct: 21, base: "1.000,00", vat: "210,00" }],
	category: "professional_services",
	sourceQuote: "Total: 1.234,56 EUR",
	bodyMarkdown: "## Factura Acme SL\n\nTotal: 1.234,56 EUR",
};

const pending: AgentPendingAttachment = {
	gmailMessageId: "msg-endesa-03",
	receivedDate: "2026-06-19",
	vendor: "Endesa",
};

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "tax-agent-b3-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const perms = (path: string): number => statSync(path).mode & 0o777;

describe("writeBillFile", () => {
	it("writes to root/YYYY-MM/<vendor>-<issueDate>.md with a sanitized vendor", () => {
		const path = writeBillFile(root, bill, "claude");
		expect(path).toBe(join(root, "2026-06", "acme-sl-2026-06-15.md"));
	});

	it("groups by receivedDate and names by receivedDate when issueDate is null", () => {
		const path = writeBillFile(
			root,
			{ ...bill, receivedDate: "2026-05-30", issueDate: null },
			"codex",
		);
		expect(path).toBe(join(root, "2026-05", "acme-sl-2026-05-30.md"));
	});

	it("keeps the directory 0700 and the file 0600", () => {
		const path = writeBillFile(root, bill, "claude");
		expect(perms(path)).toBe(0o600);
		expect(perms(dirname(path))).toBe(0o700);
	});

	it("writes frontmatter and the traceable Fuente line", () => {
		const path = writeBillFile(root, bill, "claude");
		const text = readFileSync(path, "utf8");
		expect(text).toContain('gmailMessageId: "msg-acme-01"');
		expect(text).toContain('extractor: "claude"');
		expect(text).toContain('currency: "EUR"');
		expect(text).toContain('total: "1.234,56"');
		expect(text).toContain('category: "professional_services"');
		expect(text).toContain("## Factura Acme SL");
		expect(text).toContain("> Fuente: Total: 1.234,56 EUR");
	});

	it("adds a numeric suffix on collision instead of overwriting", () => {
		const first = writeBillFile(root, bill, "claude");
		const second = writeBillFile(root, bill, "claude");
		expect(second).not.toBe(first);
		expect(basename(second)).toBe("acme-sl-2026-06-15-2.md");
	});
});

describe("writePendingAttachmentFile", () => {
	it("writes a flagged stub carrying the gmail id", () => {
		const path = writePendingAttachmentFile(root, pending);
		expect(path).toBe(join(root, "2026-06", "endesa-2026-06-19-pendiente.md"));
		const text = readFileSync(path, "utf8");
		expect(text).toContain("adjunto pendiente de descarga manual");
		expect(text).toContain("msg-endesa-03");
	});

	it("falls back to an 'adjunto' slug when the vendor is null", () => {
		const path = writePendingAttachmentFile(root, { ...pending, vendor: null });
		expect(basename(path)).toBe("adjunto-2026-06-19-pendiente.md");
	});

	it("keeps stub perms private (dir 0700, file 0600)", () => {
		const path = writePendingAttachmentFile(root, pending);
		expect(perms(path)).toBe(0o600);
		expect(perms(dirname(path))).toBe(0o700);
	});
});
