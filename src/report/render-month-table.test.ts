import { describe, expect, it } from "vitest";
import { ES_FIXTURES } from "../countries/es/fixtures";
import { buildMonthReport } from "../countries/es/report";
import { type CountryReport, figure } from "../countries/types";
import type { BillRecord } from "../domain/bill";
import type { Profile } from "../domain/profile";
import { formatEurCents, renderMonthTable } from "./render-month-table";

function bill(o: Partial<BillRecord> & { id: number }): BillRecord {
	return {
		emailId: o.id,
		gmailMessageId: `g${o.id}`,
		vendor: "Vendor",
		issueDate: "2026-07-03",
		receivedDate: "2026-07-03",
		currency: "EUR",
		totalCents: 12100,
		vatLines: [{ ratePct: 21, baseCents: 10000, vatCents: 2100 }],
		category: "software",
		filePath: `/d/g${o.id}.md`,
		sourceQuote: "q",
		extractor: "agent",
		verified: true,
		extractedAt: "2026-07-04T00:00:00.000Z",
		...o,
	};
}

const POPULATED_BILLS: readonly BillRecord[] = [
	bill({
		id: 1,
		vendor: "Acme SL",
		category: "software",
		totalCents: 121000,
		vatLines: [{ ratePct: 21, baseCents: 100000, vatCents: 21000 }],
		issueDate: "2026-07-03",
	}),
	bill({
		id: 2,
		vendor: "Telco",
		category: "telecom",
		totalCents: 6050,
		vatLines: [{ ratePct: 21, baseCents: 5000, vatCents: 1050 }],
		issueDate: "2026-07-10",
	}),
];

const POPULATED_REPORT: CountryReport = {
	country: "es",
	month: "2026-07",
	figures: [
		figure("Total facturas 2026-07", 127050, [
			{ kind: "bill", billId: 1 },
			{ kind: "bill", billId: 2 },
		]),
		figure("IVA soportado 21%", 22050, [
			{ kind: "bill", billId: 1 },
			{ kind: "bill", billId: 2 },
			{ kind: "rule", ruleId: "LIVA-90.Uno" },
		]),
	],
	notes: [],
};

const NO_REPORT: CountryReport = {
	country: "es",
	month: "2026-07",
	figures: [],
	notes: [],
};

/** Widths of the per-bill table lines (between the title block and the summary) — must be uniform. */
function tableLineWidths(text: string): number[] {
	const lines = text.split("\n");
	const start = 2; // after "Facturas …" + blank
	const end = lines.indexOf("", start); // blank line before the summary
	return lines.slice(start, end === -1 ? undefined : end).map((l) => l.length);
}

describe("formatEurCents (AC#2 — integer cents, es-ES)", () => {
	it.each([
		[123456, "1.234,56 €"],
		[0, "0,00 €"],
		[99, "0,99 €"],
		[5, "0,05 €"],
		[100, "1,00 €"],
		[60050, "600,50 €"],
		[1234567, "12.345,67 €"],
		[100000000, "1.000.000,00 €"],
		[-100, "-1,00 €"],
	])("formats %d cents as %s", (cents, expected) => {
		expect(formatEurCents(cents)).toBe(expected);
	});
});

describe("renderMonthTable — populated month (AC#1)", () => {
	const out = renderMonthTable({
		month: "2026-07",
		bills: POPULATED_BILLS,
		report: POPULATED_REPORT,
		pendingCount: 0,
	});

	it("renders the golden table with categoría, totals and es citations", () => {
		expect(out).toMatchInlineSnapshot(`
			"Facturas 2026-07

			Fecha        Proveedor      Categoría     Importe       IVA
			-----------------------------------------------------------
			2026-07-03   Acme SL        software   1.210,00 €  210,00 €
			2026-07-10   Telco          telecom       60,50 €   10,50 €
			-----------------------------------------------------------
			             Total EUR (2)             1.270,50 €  220,50 €

			Resumen es — 2026-07
			  Total facturas 2026-07  1.270,50 €
			  IVA soportado 21%         220,50 €  [LIVA-90.Uno]"
		`);
	});

	it("aligns every table row to the same width", () => {
		expect(new Set(tableLineWidths(out)).size).toBe(1);
	});

	it("tags the rule only on the figure that carries one", () => {
		expect(out).toContain("[LIVA-90.Uno]");
		const totalLine = out
			.split("\n")
			.find((l) => l.includes("Total facturas 2026-07"));
		expect(totalLine).not.toContain("[");
	});
});

describe("renderMonthTable — non-EUR bill (AC#1)", () => {
	it("keeps the foreign currency code and excludes it from the EUR total", () => {
		const bills = [
			bill({ id: 1, vendor: "Acme SL", totalCents: 121000, currency: "EUR" }),
			bill({
				id: 2,
				vendor: "US Vendor",
				totalCents: 50000,
				currency: "USD",
				vatLines: [],
			}),
		];
		const out = renderMonthTable({
			month: "2026-07",
			bills,
			report: NO_REPORT,
			pendingCount: 0,
		});
		expect(out).toContain("500,00 USD");
		expect(out).not.toContain("500,00 €");
		// The Total EUR row counts only the EUR bill and sums only its amount.
		const totalLine = out.split("\n").find((l) => l.includes("Total EUR"));
		expect(totalLine).toContain("Total EUR (1)");
		expect(totalLine).toContain("1.210,00 €");
	});
});

describe("renderMonthTable — empty month (AC#1)", () => {
	it("shows the Spanish empty-month line and any country notes", () => {
		const out = renderMonthTable({
			month: "2026-08",
			bills: [],
			report: {
				country: "es",
				month: "2026-08",
				figures: [],
				notes: ["Sin facturas en EUR para 2026-08."],
			},
			pendingCount: 0,
		});
		expect(out).toBe(
			[
				"Facturas 2026-08",
				"",
				"Sin facturas en 2026-08.",
				"",
				"Notas:",
				"  · Sin facturas en EUR para 2026-08.",
			].join("\n"),
		);
	});
});

describe("renderMonthTable — annotations (AC#1)", () => {
	const bills = [
		bill({
			id: 3,
			vendor: "Unverified Co",
			category: "hardware",
			totalCents: 5000,
			vatLines: [{ ratePct: 10, baseCents: 4545, vatCents: 455 }],
			verified: false,
			issueDate: "2026-07-05",
		}),
	];
	const report: CountryReport = {
		country: "es",
		month: "2026-07",
		figures: [
			figure("Total facturas 2026-07", 5000, [{ kind: "bill", billId: 3 }]),
		],
		notes: ["1 factura(s) sin verificación de importes."],
	};
	const out = renderMonthTable({
		month: "2026-07",
		bills,
		report,
		pendingCount: 2,
	});

	it("marks the unverified row and footers the pending warning + legend", () => {
		expect(out).toMatchInlineSnapshot(`
			"Facturas 2026-07

			Fecha        Proveedor      Categoría  Importe     IVA
			------------------------------------------------------
			2026-07-05  ~Unverified Co  hardware   50,00 €  4,55 €
			------------------------------------------------------
			             Total EUR (1)             50,00 €  4,55 €

			Resumen es — 2026-07
			  Total facturas 2026-07  50,00 €

			Notas:
			  · 1 factura(s) sin verificación de importes.
			  · ⚠ 2 factura(s) con adjunto pendiente de descarga manual
			  · ~ importes sin verificar"
		`);
	});

	it("omits the pending warning and legend when nothing is pending or unverified", () => {
		const clean = renderMonthTable({
			month: "2026-07",
			bills: [bill({ id: 9, verified: true })],
			report: NO_REPORT,
			pendingCount: 0,
		});
		expect(clean).not.toContain("adjunto pendiente");
		expect(clean).not.toContain("sin verificar");
	});
});

describe("renderMonthTable — long-vendor truncation (AC#1)", () => {
	it("truncates a vendor over 24 chars to a single ellipsis-capped cell", () => {
		const long = "Servicios Profesionales Internacionales SL";
		const out = renderMonthTable({
			month: "2026-07",
			bills: [bill({ id: 4, vendor: long, totalCents: 100000 })],
			report: NO_REPORT,
			pendingCount: 0,
		});
		const row = out.split("\n").find((l) => l.includes("Servicios"));
		expect(row).toContain("Servicios Profesionales…");
		expect(row).not.toContain(long);
		expect(new Set(tableLineWidths(out)).size).toBe(1);
	});
});

describe("renderMonthTable — real es report end to end (AC#1 citations)", () => {
	const SELF_EMPLOYED: Profile = {
		id: "me",
		country: "es",
		residency: "resident",
		taxYear: 2026,
		filingSituation: "self_employed",
	};

	it("renders citations produced by the actual es module", () => {
		const report = buildMonthReport({
			bills: ES_FIXTURES,
			profile: SELF_EMPLOYED,
			month: "2026-07",
		});
		const out = renderMonthTable({
			month: "2026-07",
			bills: [...ES_FIXTURES],
			report,
			pendingCount: 0,
		});
		expect(out).toContain("IVA soportado 21%");
		expect(out).toContain("[LIVA-90.Uno]");
		expect(out).toContain("Resumen es — 2026-07");
	});
});
