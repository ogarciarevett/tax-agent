import type { z } from "zod";
import type { BillRecord } from "../domain/bill";
import type { CountrySchema, Profile } from "../domain/profile";

// Country-agnostic contract for the per-country tax modules. NOTHING here knows about Spain —
// country-specific figures, rates and citations live under src/countries/<code>/ (contract hard
// rule: country logic never leaks into shared code). Adding a country is purely additive.

/** Supported country code. Derived from the frozen profile schema so widening it there (adding an
 *  ISO code) widens this union automatically — one source of truth for "which countries exist". */
export type Country = z.infer<typeof CountrySchema>;

/** Where a report number comes from: a concrete stored bill, or a cited country rule. Every figure
 *  carries at least one — a tax number with no provenance must be impossible to construct. */
export type FigureSource =
	| { readonly kind: "bill"; readonly billId: number }
	| { readonly kind: "rule"; readonly ruleId: string };

/** A single line in a report: a label, an integer-cents amount, and its traceable sources. */
export interface TraceableFigure {
	readonly label: string;
	readonly amountCents: number;
	readonly sources: readonly FigureSource[];
}

/**
 * The ONLY way to build a TraceableFigure — throws when `sources` is empty. This makes the
 * project hard rule ("no report number without a traceable source") a compile-of-construction
 * invariant: an un-sourced figure cannot exist at runtime.
 */
export function figure(
	label: string,
	amountCents: number,
	sources: readonly FigureSource[],
): TraceableFigure {
	if (sources.length === 0) {
		throw new Error(
			`Refusing to build tax figure "${label}" with no traceable source ` +
				"(every report number must trace to a bill or a cited rule).",
		);
	}
	return { label, amountCents, sources };
}

/** A country report for ONE month (its consumer, B6, renders one month at a time). Quarterly
 *  context figures for the quarter containing `month` are included among `figures`. */
export interface CountryReport {
	readonly country: Country;
	/** The reported month, "YYYY-MM". */
	readonly month: string;
	readonly figures: readonly TraceableFigure[];
	readonly notes: readonly string[];
}

export interface MonthReportInput {
	readonly bills: readonly BillRecord[];
	readonly profile: Profile;
	/** "YYYY-MM" — the month to report. */
	readonly month: string;
}

/** One per supported country. The registry maps a Country code to its module. */
export interface CountryModule {
	readonly code: Country;
	buildMonthReport(input: MonthReportInput): CountryReport;
}
