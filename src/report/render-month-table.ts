import type { CountryReport, TraceableFigure } from "../countries/types";
import type { BillRecord } from "../domain/bill";

// Pure month-table renderer. Its LABELS are Spanish (Spain-first UI) but it contains NO country tax
// logic — it only lays out whatever figures + rule ids the country module produced (contract hard
// rule: country rules never leak into shared code). Money is built from integer cents with string
// ops only — no float, and no €-symbol is ever put on a non-EUR amount.

const MAX_VENDOR = 24;
const GAP = "  ";
const UNVERIFIED_MARK = "~";

/** Integer cents → es-ES number, e.g. 123456 → "1.234,56". Integer division + padStart, no floats. */
function formatDecimalCents(cents: number): string {
	const negative = cents < 0;
	const abs = Math.abs(cents);
	const whole = groupThousands(Math.floor(abs / 100).toString());
	const frac = (abs % 100).toString().padStart(2, "0");
	return `${negative ? "-" : ""}${whole},${frac}`;
}

/** Integer cents → es-ES euros, e.g. 123456 → "1.234,56 €". */
export function formatEurCents(cents: number): string {
	return `${formatDecimalCents(cents)} €`;
}

/** Money in its own currency: EUR gets the € symbol, anything else keeps its ISO code (no € on it). */
function formatMoneyCents(cents: number, currency: string): string {
	return currency === "EUR"
		? formatEurCents(cents)
		: `${formatDecimalCents(cents)} ${currency}`;
}

/** Group an integer-digit string into es-ES thousands: "1234567" → "1.234.567". */
function groupThousands(digits: string): string {
	let out = "";
	for (let i = 0; i < digits.length; i++) {
		if (i > 0 && (digits.length - i) % 3 === 0) {
			out += ".";
		}
		out += digits.charAt(i);
	}
	return out;
}

/** Grouping/printed date: the bill's issue date, falling back to the received date (see BillRecord). */
function billDate(bill: BillRecord): string {
	return bill.issueDate ?? bill.receivedDate;
}

function billVatCents(bill: BillRecord): number {
	return bill.vatLines.reduce((acc, line) => acc + line.vatCents, 0);
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** The `[rule …]` tags for a figure — its rule-kind sources only (bill ids stay in the DB). */
function ruleTags(figure: TraceableFigure): string {
	const rules = figure.sources.flatMap((s) =>
		s.kind === "rule" ? [s.ruleId] : [],
	);
	return rules.length === 0 ? "" : `[${rules.join(", ")}]`;
}

type Align = "left" | "right";
interface Cell {
	readonly text: string;
	readonly align: Align;
}

function billCells(bill: BillRecord): Cell[] {
	const mark = bill.verified ? " " : UNVERIFIED_MARK;
	return [
		{ text: billDate(bill), align: "left" },
		{ text: `${mark}${truncate(bill.vendor, MAX_VENDOR)}`, align: "left" },
		{ text: bill.category, align: "left" },
		{ text: formatMoneyCents(bill.totalCents, bill.currency), align: "right" },
		{
			text: formatMoneyCents(billVatCents(bill), bill.currency),
			align: "right",
		},
	];
}

/** Per-bill table with a header and a EUR-only Total row (mirrors the es module's total figure). */
function renderBillTable(bills: readonly BillRecord[]): string[] {
	const eur = bills.filter((b) => b.currency === "EUR");
	const totalCents = eur.reduce((acc, b) => acc + b.totalCents, 0);
	const totalVat = eur.reduce((acc, b) => acc + billVatCents(b), 0);

	const header: Cell[] = [
		{ text: "Fecha", align: "left" },
		{ text: " Proveedor", align: "left" },
		{ text: "Categoría", align: "left" },
		{ text: "Importe", align: "right" },
		{ text: "IVA", align: "right" },
	];
	const total: Cell[] = [
		{ text: "", align: "left" },
		{ text: ` Total EUR (${eur.length})`, align: "left" },
		{ text: "", align: "left" },
		{ text: formatEurCents(totalCents), align: "right" },
		{ text: formatEurCents(totalVat), align: "right" },
	];
	const rows = [header, ...bills.map(billCells), total];

	const widths = header.map((_, col) =>
		Math.max(...rows.map((r) => (r[col]?.text ?? "").length)),
	);
	const line = (cells: Cell[]): string =>
		cells
			.map((c, col) => {
				const width = widths[col] ?? 0;
				return c.align === "right"
					? c.text.padStart(width)
					: c.text.padEnd(width);
			})
			.join(GAP);

	const headerLine = line(header);
	const rule = "-".repeat(headerLine.length);
	return [
		headerLine,
		rule,
		...bills.map((b) => line(billCells(b))),
		rule,
		line(total),
	];
}

/** The country summary: one line per figure — label, right-aligned amount, then its `[rule …]` tags. */
function renderSummary(report: CountryReport): string[] {
	if (report.figures.length === 0) {
		return [];
	}
	const labelW = Math.max(...report.figures.map((f) => f.label.length));
	const amountW = Math.max(
		...report.figures.map((f) => formatEurCents(f.amountCents).length),
	);
	const rows = report.figures.map((f) => {
		const amount = formatEurCents(f.amountCents).padStart(amountW);
		const tags = ruleTags(f);
		return `  ${f.label.padEnd(labelW)}${GAP}${amount}${tags ? `${GAP}${tags}` : ""}`;
	});
	return [`Resumen ${report.country} — ${report.month}`, ...rows];
}

/** Honesty footer: country notes, a manual-download warning, and the unverified-mark legend. */
function renderNotes(
	bills: readonly BillRecord[],
	report: CountryReport,
	pendingCount: number,
): string[] {
	const notes = [...report.notes];
	if (pendingCount > 0) {
		notes.push(
			`⚠ ${pendingCount} factura(s) con adjunto pendiente de descarga manual`,
		);
	}
	if (bills.some((b) => !b.verified)) {
		notes.push(`${UNVERIFIED_MARK} importes sin verificar`);
	}
	return notes.length === 0 ? [] : ["Notas:", ...notes.map((n) => `  · ${n}`)];
}

export interface MonthTableInput {
	readonly month: string;
	readonly bills: readonly BillRecord[];
	readonly report: CountryReport;
	/** Count of billing emails whose figures live only in an un-opened attachment (bill-less). */
	readonly pendingCount: number;
}

/**
 * Render one month as a plain string: title, per-bill table (or an empty-month line), the country
 * summary with citations, and an honesty footer. Non-EUR bills keep their own currency code and are
 * excluded from the EUR Total; `pendingCount` surfaces attachment-only emails so nothing is dropped.
 */
export function renderMonthTable(input: MonthTableInput): string {
	const { month, bills, report, pendingCount } = input;
	const lines: string[] = [`Facturas ${month}`, ""];
	lines.push(
		...(bills.length === 0
			? [`Sin facturas en ${month}.`]
			: renderBillTable(bills)),
	);

	const summary = renderSummary(report);
	if (summary.length > 0) {
		lines.push("", ...summary);
	}
	const notes = renderNotes(bills, report, pendingCount);
	if (notes.length > 0) {
		lines.push("", ...notes);
	}
	return lines.join("\n");
}
