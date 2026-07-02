import { describe, expect, it } from "vitest";
import type { BillRecord } from "../../domain/bill";
import type { Profile } from "../../domain/profile";
import { type CountryReport, figure, type TraceableFigure } from "../types";
import { ES_FIXTURES } from "./fixtures";
import { buildMonthReport } from "./report";
import { ES_RULES } from "./rules";

const SELF_EMPLOYED: Profile = {
	id: "me",
	country: "es",
	residency: "resident",
	taxYear: 2026,
	filingSituation: "self_employed",
};
const EMPLOYED: Profile = { ...SELF_EMPLOYED, filingSituation: "employed" };

function must<T>(value: T | undefined, what: string): T {
	if (value === undefined) {
		throw new Error(`expected ${what}`);
	}
	return value;
}

function findFigure(report: CountryReport, label: string): TraceableFigure {
	return must(
		report.figures.find((f) => f.label === label),
		`figure "${label}"`,
	);
}

function findFigureBy(
	report: CountryReport,
	pred: (f: TraceableFigure) => boolean,
	what: string,
): TraceableFigure {
	return must(report.figures.find(pred), what);
}

function amountOf(report: CountryReport, label: string): number {
	return findFigure(report, label).amountCents;
}

function billIdsOf(fig: TraceableFigure): number[] {
	return fig.sources.flatMap((s) => (s.kind === "bill" ? [s.billId] : []));
}

describe("buildMonthReport — es golden numbers (2026-07, self_employed)", () => {
	const report = buildMonthReport({
		bills: ES_FIXTURES,
		profile: SELF_EMPLOYED,
		month: "2026-07",
	});

	it("monthly invoiced total sums only July EUR bills", () => {
		// 121000 + 6050 + 4400 + 9680 + 14300 + 24200 = 179630
		// (USD id7 and June id8 are NOT July EUR bills → excluded)
		expect(amountOf(report, "Total facturas 2026-07")).toBe(179630);
		expect(billIdsOf(findFigure(report, "Total facturas 2026-07"))).toEqual([
			1, 2, 3, 4, 5, 6,
		]);
	});

	it("per-rate IVA breakdown sums each rate's lines", () => {
		// 21%: 21000 + 1050 + 1680 + 2100 + 4200 = 30030 (bills 1,2,4,5,6)
		// 10%:   400 + 200                     =   600 (bills 3,5)
		expect(amountOf(report, "IVA soportado 21%")).toBe(30030);
		expect(amountOf(report, "IVA soportado 10%")).toBe(600);
		expect(billIdsOf(findFigure(report, "IVA soportado 21%"))).toEqual([
			1, 2, 4, 5, 6,
		]);
		expect(billIdsOf(findFigure(report, "IVA soportado 10%"))).toEqual([3, 5]);
	});

	it("deductible IVA sums deductible categories only (meals id3 excluded)", () => {
		// 21000 + 1050 + 1680 + 2300 + 4200 = 30230
		expect(
			amountOf(report, "IVA soportado deducible (estimación, solo gastos)"),
		).toBe(30230);
	});

	it("deductible IRPF base sums ex-IVA bases of deductible bills", () => {
		// 100000 + 5000 + 8000 + 12000 + 20000 = 145000
		expect(
			amountOf(report, "Gastos deducibles IRPF (estimación, solo gastos)"),
		).toBe(145000);
	});

	it("quarter T3 context equals the month here (all deductible bills are July)", () => {
		expect(
			amountOf(
				report,
				"IVA soportado deducible T3 2026 (solo gastos — Modelo 303)",
			),
		).toBe(30230);
		expect(
			amountOf(report, "Gastos deducibles T3 2026 (solo gastos — Modelo 130)"),
		).toBe(145000);
	});

	it("reports the USD bill as a per-currency note, out of every sum and never €-formatted", () => {
		// Mixed currencies don't add and must never render with a € sign, so exclusions are
		// traceable NOTES (with bill ids), not amount figures.
		expect(report.figures.some((f) => f.label.includes("Excluidas"))).toBe(
			false,
		);
		expect(report.notes).toContain("Excluidas 1 factura(s) en USD (ids: 7).");
	});

	it("annotates unverified + excluded, without the employed note", () => {
		expect(report.notes).toContain(
			"1 factura(s) sin verificación de importes.",
		);
		expect(report.notes.some((n) => n.startsWith("Excluidas"))).toBe(true);
		expect(report.notes.some((n) => n.includes("empleado"))).toBe(false);
	});
});

describe("buildMonthReport — employed forces every deductible to a cited 0", () => {
	const report = buildMonthReport({
		bills: ES_FIXTURES,
		profile: EMPLOYED,
		month: "2026-07",
	});

	it("leaves total and per-rate breakdown unchanged", () => {
		expect(amountOf(report, "Total facturas 2026-07")).toBe(179630);
		expect(amountOf(report, "IVA soportado 21%")).toBe(30030);
	});

	it("zeroes deductible IVA/IRPF with rule-only sources", () => {
		const vat = findFigureBy(
			report,
			(f) => f.label.startsWith("IVA soportado deducible ("),
			"monthly deductible IVA",
		);
		expect(vat.amountCents).toBe(0);
		expect(vat.sources).toEqual([{ kind: "rule", ruleId: "LIVA-95" }]);
		const irpf = findFigureBy(
			report,
			(f) => f.label.startsWith("Gastos deducibles IRPF"),
			"monthly deductible IRPF",
		);
		expect(irpf.amountCents).toBe(0);
		expect(irpf.sources).toEqual([{ kind: "rule", ruleId: "LIRPF-30" }]);
	});

	it("zeroes the quarter context with rule-only sources", () => {
		const q303 = findFigureBy(
			report,
			(f) => f.label.includes("Modelo 303"),
			"quarter 303",
		);
		expect(q303.amountCents).toBe(0);
		expect(q303.sources).toEqual([{ kind: "rule", ruleId: "AEAT-M303" }]);
		const q130 = findFigureBy(
			report,
			(f) => f.label.includes("Modelo 130"),
			"quarter 130",
		);
		expect(q130.amountCents).toBe(0);
		expect(q130.sources).toEqual([{ kind: "rule", ruleId: "AEAT-M130" }]);
	});

	it("adds the employed note", () => {
		expect(report.notes.some((n) => n.includes("empleado"))).toBe(true);
	});
});

describe("structural traceability sweep (acceptance criterion 2)", () => {
	it("every figure in a full report traces to input bills and known rules", () => {
		const report = buildMonthReport({
			bills: ES_FIXTURES,
			profile: SELF_EMPLOYED,
			month: "2026-07",
		});
		const billIds = new Set(ES_FIXTURES.map((b) => b.id));
		const ruleIds = new Set(Object.keys(ES_RULES));
		expect(report.figures.length).toBeGreaterThan(0);
		for (const fig of report.figures) {
			expect(fig.sources.length).toBeGreaterThan(0);
			for (const src of fig.sources) {
				if (src.kind === "bill") {
					expect(billIds.has(src.billId)).toBe(true);
				} else {
					expect(ruleIds.has(src.ruleId)).toBe(true);
				}
			}
		}
	});

	it("holds for the employed report too (rule-only figures included)", () => {
		const report = buildMonthReport({
			bills: ES_FIXTURES,
			profile: EMPLOYED,
			month: "2026-07",
		});
		const ruleIds = new Set(Object.keys(ES_RULES));
		for (const fig of report.figures) {
			for (const src of fig.sources) {
				if (src.kind === "rule") {
					expect(ruleIds.has(src.ruleId)).toBe(true);
				}
			}
		}
	});
});

describe("figure() provenance guard (acceptance criterion 3)", () => {
	it("throws when built without any source", () => {
		expect(() => figure("no provenance", 100, [])).toThrow(/traceable source/);
	});

	it("builds when at least one source is present", () => {
		expect(
			figure("ok", 100, [{ kind: "rule", ruleId: "LIVA-95" }]).amountCents,
		).toBe(100);
	});
});

describe("empty and non-deductible months (acceptance criterion 4)", () => {
	it("empty month yields no figures and an honest note, never NaN", () => {
		const report = buildMonthReport({
			bills: ES_FIXTURES,
			profile: SELF_EMPLOYED,
			month: "2026-01",
		});
		expect(report.figures).toEqual([]);
		expect(report.notes).toEqual(["Sin facturas en EUR para 2026-01."]);
	});

	it("a month of only non-deductible bills gives 0 with rule-only source (June: id8 'other')", () => {
		const report = buildMonthReport({
			bills: ES_FIXTURES,
			profile: SELF_EMPLOYED,
			month: "2026-06",
		});
		expect(amountOf(report, "Total facturas 2026-06")).toBe(3630);
		expect(amountOf(report, "IVA soportado 21%")).toBe(630);
		const vat = findFigureBy(
			report,
			(f) => f.label.startsWith("IVA soportado deducible ("),
			"June deductible IVA",
		);
		expect(vat.amountCents).toBe(0);
		expect(Number.isNaN(vat.amountCents)).toBe(false);
		expect(vat.sources).toEqual([{ kind: "rule", ruleId: "LIVA-95" }]);
	});
});

describe("quarter boundary (2026-06-30 in T2, 2026-07-01 in T3)", () => {
	const base = must(ES_FIXTURES[0], "fixture id1");
	const june30: BillRecord = {
		...base,
		id: 201,
		issueDate: "2026-06-30",
		receivedDate: "2026-06-30",
	};
	const july01: BillRecord = {
		...base,
		id: 202,
		issueDate: "2026-07-01",
		receivedDate: "2026-07-01",
	};
	const report = buildMonthReport({
		bills: [june30, july01],
		profile: SELF_EMPLOYED,
		month: "2026-07",
	});

	it("the month total counts only the July-01 bill", () => {
		expect(billIdsOf(findFigure(report, "Total facturas 2026-07"))).toEqual([
			202,
		]);
	});

	it("the T3 quarter context excludes the June-30 bill", () => {
		const q303 = findFigureBy(
			report,
			(f) => f.label.includes("Modelo 303"),
			"quarter 303",
		);
		const ids = billIdsOf(q303);
		expect(ids).toContain(202);
		expect(ids).not.toContain(201);
	});
});

describe("rate + date edge cases", () => {
	it("0% lines produce a bill-only sourced figure (no rate article to cite)", () => {
		const base = must(ES_FIXTURES[1], "fixture id2");
		const exempt: BillRecord = {
			...base,
			id: 300,
			totalCents: 5000,
			vatLines: [{ ratePct: 0, baseCents: 5000, vatCents: 0 }],
			issueDate: "2026-07-03",
			receivedDate: "2026-07-03",
		};
		const report = buildMonthReport({
			bills: [exempt],
			profile: SELF_EMPLOYED,
			month: "2026-07",
		});
		const zero = findFigure(report, "IVA soportado 0%");
		expect(zero.amountCents).toBe(0);
		expect(zero.sources).toEqual([{ kind: "bill", billId: 300 }]);
	});

	it("cites the superreducido article for a 4% line (April fixture id9)", () => {
		// base 25000 + IVA 1000 = 26000; 4% maps to LIVA-91.Dos
		const report = buildMonthReport({
			bills: ES_FIXTURES,
			profile: SELF_EMPLOYED,
			month: "2026-04",
		});
		expect(amountOf(report, "Total facturas 2026-04")).toBe(26000);
		const rate4 = findFigure(report, "IVA soportado 4%");
		expect(rate4.amountCents).toBe(1000);
		expect(rate4.sources).toContainEqual({
			kind: "rule",
			ruleId: "LIVA-91.Dos",
		});
		expect(billIdsOf(rate4)).toEqual([9]);
	});

	it("groups by receivedDate when issueDate is null", () => {
		const base = must(ES_FIXTURES[0], "fixture id1");
		const noIssue: BillRecord = {
			...base,
			id: 400,
			issueDate: null,
			receivedDate: "2026-07-09",
		};
		const report = buildMonthReport({
			bills: [noIssue],
			profile: SELF_EMPLOYED,
			month: "2026-07",
		});
		expect(amountOf(report, "Total facturas 2026-07")).toBe(noIssue.totalCents);
	});
});

describe("quarter figures cover the whole quarter, not just the displayed month", () => {
	// Regression for the consensus-review CRITICAL: with a multi-month input set, the T2 lines
	// must include April's deductible bill (id 9) even when June is the displayed month.
	const report = buildMonthReport({
		bills: ES_FIXTURES,
		profile: SELF_EMPLOYED,
		month: "2026-06",
	});

	it("monthly deducible is 0 (June holds only the non-deductible id 8)", () => {
		expect(
			amountOf(report, "IVA soportado deducible (estimación, solo gastos)"),
		).toBe(0);
	});

	it("T2 Modelo 303/130 lines include April's bill", () => {
		expect(
			amountOf(
				report,
				"IVA soportado deducible T2 2026 (solo gastos — Modelo 303)",
			),
		).toBe(1000); // id 9: IVA 4% de 250,00 = 10,00
		expect(
			amountOf(report, "Gastos deducibles T2 2026 (solo gastos — Modelo 130)"),
		).toBe(25000); // id 9: base 250,00
	});
});
