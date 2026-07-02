import type { BillRecord } from "../../domain/bill";
import {
	type CountryModule,
	type CountryReport,
	type FigureSource,
	figure,
	type MonthReportInput,
	type TraceableFigure,
} from "../types";
import { DEDUCTIBLE_SHARE, type EsRuleId, ivaRateRuleId } from "./rules";

// Spain (`es`) report engine — pure functions, NO I/O. The caller (B6) passes month-filtered bills
// from the repo; we re-filter defensively so a figure can never count a bill from another period.
// Only the expense side is modelled: without income data a full Modelo 303/130 is impossible, so
// every tax estimate is labelled "(solo gastos)" to stay honest.

const COUNTRY = "es" as const;

/** Grouping key: the printed issue date, falling back to receivedDate (see BillRecord). */
function billDate(bill: BillRecord): string {
	return bill.issueDate ?? bill.receivedDate;
}

function isEur(bill: BillRecord): boolean {
	return bill.currency === "EUR";
}

function sumVatCents(bill: BillRecord): number {
	return bill.vatLines.reduce((acc, line) => acc + line.vatCents, 0);
}

function billSources(ids: readonly number[]): FigureSource[] {
	return ids.map((billId) => ({ kind: "bill", billId }));
}

function ruleSources(ids: readonly EsRuleId[]): FigureSource[] {
	return [...new Set(ids)].map((ruleId) => ({ kind: "rule", ruleId }));
}

/**
 * A figure traceable to contributing bills PLUS at least one cited rule. The rule list is never
 * empty, so figure() cannot throw even when no bill contributed — the result is an honest 0 with
 * rule-only provenance (e.g. an employee's non-deductible line).
 */
function traceable(
	label: string,
	amountCents: number,
	billIds: readonly number[],
	ruleIds: readonly EsRuleId[],
): TraceableFigure {
	return figure(label, amountCents, [
		...billSources(billIds),
		...ruleSources(ruleIds),
	]);
}

function quarterOf(month: string): number {
	const monthNum = Number(month.slice(5, 7));
	return Math.floor((monthNum - 1) / 3) + 1;
}

function inQuarter(bill: BillRecord, year: string, quarter: number): boolean {
	const date = billDate(bill);
	return date.slice(0, 4) === year && quarterOf(date.slice(0, 7)) === quarter;
}

interface Deductible {
	readonly vatCents: number;
	readonly expenseCents: number;
	readonly billIds: readonly number[];
	readonly ruleIds: readonly EsRuleId[];
}

/**
 * Expense-side deductible IVA + IRPF base over the given bills. When the profile has no economic
 * activity (employed) nothing is deductible: returns zeros with no bill provenance so the caller
 * emits a rule-only, honest 0. The per-category share is applied with exactly one Math.round per
 * bill, keeping money in integer cents.
 */
function accrueDeductible(
	bills: readonly BillRecord[],
	hasActivity: boolean,
): Deductible {
	if (!hasActivity) {
		return { vatCents: 0, expenseCents: 0, billIds: [], ruleIds: [] };
	}
	let vatCents = 0;
	let expenseCents = 0;
	const billIds: number[] = [];
	const ruleIds = new Set<EsRuleId>();
	for (const bill of bills) {
		const { share, ruleId } = DEDUCTIBLE_SHARE[bill.category];
		if (share <= 0) {
			continue;
		}
		const vat = sumVatCents(bill);
		vatCents += Math.round(vat * share);
		expenseCents += Math.round((bill.totalCents - vat) * share);
		billIds.push(bill.id);
		ruleIds.add(ruleId);
	}
	return { vatCents, expenseCents, billIds, ruleIds: [...ruleIds] };
}

/** One "IVA soportado <rate>%" figure per rate actually present, summing that rate's vat lines. */
function perRateFigures(bills: readonly BillRecord[]): TraceableFigure[] {
	const byRate = new Map<number, { vatCents: number; billIds: Set<number> }>();
	for (const bill of bills) {
		for (const line of bill.vatLines) {
			const entry = byRate.get(line.ratePct) ?? {
				vatCents: 0,
				billIds: new Set<number>(),
			};
			entry.vatCents += line.vatCents;
			entry.billIds.add(bill.id);
			byRate.set(line.ratePct, entry);
		}
	}
	return [...byRate.entries()]
		.sort(([a], [b]) => b - a)
		.map(([rate, entry]) => {
			const ruleId = ivaRateRuleId(rate);
			return traceable(
				`IVA soportado ${rate}%`,
				entry.vatCents,
				[...entry.billIds],
				ruleId ? [ruleId] : [],
			);
		});
}

/**
 * Build the Spain report for `input.month`. Monthly totals + per-rate breakdown + expense-side
 * deductible estimates, plus quarterly context for the quarter containing the month. Non-EUR bills
 * are excluded from every sum and surfaced as their own figure; unverified bills are counted but
 * annotated. An `employed` profile (no economic activity) forces all deductibles to a cited 0.
 */
export function buildMonthReport(input: MonthReportInput): CountryReport {
	const { bills, profile, month } = input;
	const hasActivity = profile.filingSituation !== "employed";

	const monthBills = bills.filter((b) => billDate(b).slice(0, 7) === month);
	const monthEur = monthBills.filter(isEur);
	const monthNonEur = monthBills.filter((b) => !isEur(b));

	// No EUR invoices this month → nothing to compute. Honest empty report, not a fabricated 0
	// — but non-EUR bills are still surfaced so nothing is silently dropped.
	if (monthEur.length === 0) {
		return {
			country: COUNTRY,
			month,
			figures: [],
			notes: [
				`Sin facturas en EUR para ${month}.`,
				...nonEurNotes(monthNonEur),
			],
		};
	}

	const figures: TraceableFigure[] = [];
	const notes: string[] = [];

	// 1. Monthly invoiced total (documented sum, bill-traced).
	const totalCents = monthEur.reduce((acc, b) => acc + b.totalCents, 0);
	figures.push(
		figure(
			`Total facturas ${month}`,
			totalCents,
			billSources(monthEur.map((b) => b.id)),
		),
	);

	// 2. IVA soportado per rate present.
	figures.push(...perRateFigures(monthEur));

	// 3 + 4. Expense-side deductible IVA and IRPF base for the month.
	const monthly = accrueDeductible(monthEur, hasActivity);
	figures.push(
		traceable(
			"IVA soportado deducible (estimación, solo gastos)",
			monthly.vatCents,
			monthly.billIds,
			[...monthly.ruleIds, "LIVA-95"],
		),
	);
	figures.push(
		traceable(
			"Gastos deducibles IRPF (estimación, solo gastos)",
			monthly.expenseCents,
			monthly.billIds,
			["LIRPF-30"],
		),
	);

	// 5. Quarter context (Modelo 303 / 130) over the quarter that contains this month. The caller
	//    may pass a whole year's bills, so filter to the quarter here.
	const year = month.slice(0, 4);
	const quarter = quarterOf(month);
	const quarterEur = bills.filter(
		(b) => isEur(b) && inQuarter(b, year, quarter),
	);
	const quarterly = accrueDeductible(quarterEur, hasActivity);
	figures.push(
		traceable(
			`IVA soportado deducible T${quarter} ${year} (solo gastos — Modelo 303)`,
			quarterly.vatCents,
			quarterly.billIds,
			["AEAT-M303"],
		),
	);
	figures.push(
		traceable(
			`Gastos deducibles T${quarter} ${year} (solo gastos — Modelo 130)`,
			quarterly.expenseCents,
			quarterly.billIds,
			["AEAT-M130"],
		),
	);

	// 6. Honesty annotations B6 renders alongside the table. Non-EUR bills are per-currency NOTES,
	// never a summed figure: mixed currencies don't add, and a € rendering would mislabel them.
	if (!hasActivity) {
		notes.push(
			"Sin actividad económica (empleado): IVA e IRPF soportados no deducibles.",
		);
	}
	const unverified = monthEur.filter((b) => !b.verified).length;
	if (unverified > 0) {
		notes.push(`${unverified} factura(s) sin verificación de importes.`);
	}
	notes.push(...nonEurNotes(monthNonEur));

	return { country: COUNTRY, month, figures, notes };
}

/** One audit note per excluded currency, keeping the bill ids traceable. */
function nonEurNotes(nonEur: readonly BillRecord[]): string[] {
	const byCurrency = new Map<string, BillRecord[]>();
	for (const bill of nonEur) {
		const group = byCurrency.get(bill.currency) ?? [];
		group.push(bill);
		byCurrency.set(bill.currency, group);
	}
	return [...byCurrency.entries()].map(
		([currency, group]) =>
			`Excluidas ${group.length} factura(s) en ${currency} (ids: ${group
				.map((b) => b.id)
				.join(", ")}).`,
	);
}

/** The Spain module — the registry's `es` entry. */
export const esModule: CountryModule = {
	code: COUNTRY,
	buildMonthReport,
};
