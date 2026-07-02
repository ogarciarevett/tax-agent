import type { BillCategory } from "../../domain/bill";

// Spain (`es`) tax constants. SINGLE legal-accuracy edit point: every rate, share and citation
// used by es/report.ts is defined here, so correcting the law never touches report logic.

/**
 * Every ES figure cites one of these ids. id → human title + the legal/administrative source.
 * LIVA = Ley 37/1992 del IVA; LIRPF = Ley 35/2006 del IRPF; AEAT = the Spanish tax agency's forms.
 */
export const ES_RULES = {
	"LIVA-90.Uno": {
		title: "IVA — tipo general 21%",
		citation: "Art. 90.Uno, Ley 37/1992 (LIVA)",
	},
	"LIVA-91.Uno": {
		title: "IVA — tipo reducido 10%",
		citation: "Art. 91.Uno, Ley 37/1992 (LIVA)",
	},
	"LIVA-91.Dos": {
		title: "IVA — tipo superreducido 4%",
		citation: "Art. 91.Dos, Ley 37/1992 (LIVA)",
	},
	"LIVA-95": {
		title:
			"Deducción de cuotas soportadas en bienes/servicios afectos a la actividad",
		citation: "Art. 95, Ley 37/1992 (LIVA)",
	},
	"LIVA-96": {
		title: "Exclusiones y restricciones del derecho a deducir",
		citation: "Art. 96, Ley 37/1992 (LIVA)",
	},
	"LIRPF-30": {
		title: "Gastos deducibles en estimación directa (actividades económicas)",
		citation: "Art. 30, Ley 35/2006 (LIRPF)",
	},
	"AEAT-M303": {
		title: "Modelo 303 — autoliquidación trimestral del IVA",
		citation: "AEAT, Modelo 303",
	},
	"AEAT-M130": {
		title: "Modelo 130 — pago fraccionado del IRPF (estimación directa)",
		citation: "AEAT, Modelo 130",
	},
} as const;

export type EsRuleId = keyof typeof ES_RULES;

/** IVA rates the agent is expected to see on Spanish invoices (0 = exento / no sujeto). */
export const KNOWN_IVA_RATES = [21, 10, 4, 0] as const;

/**
 * The legal article that fixes each positive IVA rate — used to cite per-rate breakdown figures.
 * 0% / exempt has no single rate article, so those figures carry only their bill sources.
 */
export function ivaRateRuleId(ratePct: number): EsRuleId | undefined {
	switch (ratePct) {
		case 21:
			return "LIVA-90.Uno";
		case 10:
			return "LIVA-91.Uno";
		case 4:
			return "LIVA-91.Dos";
		default:
			return undefined;
	}
}

/**
 * Per-category deductible share (0..1) + the rule that justifies it. CONSERVATIVE starting map and
 * the one audit point for legal accuracy. Shares are applied with a single Math.round per bill so
 * money stays integer cents. utilities/rent assume full business affectation; under real mixed use
 * the prorrata rule (Art. 95 LIVA) can reduce the share — revisit HERE, never in report code.
 * meals/other are treated as non-deductible (Art. 96 LIVA excludes them absent strict conditions).
 */
export const DEDUCTIBLE_SHARE: Record<
	BillCategory,
	{ readonly share: number; readonly ruleId: EsRuleId }
> = {
	software: { share: 1, ruleId: "LIVA-95" },
	telecom: { share: 1, ruleId: "LIVA-95" },
	utilities: { share: 1, ruleId: "LIVA-95" },
	office_supplies: { share: 1, ruleId: "LIVA-95" },
	professional_services: { share: 1, ruleId: "LIVA-95" },
	travel: { share: 1, ruleId: "LIVA-95" },
	hardware: { share: 1, ruleId: "LIVA-95" },
	rent: { share: 1, ruleId: "LIVA-95" },
	meals: { share: 0, ruleId: "LIVA-96" },
	other: { share: 0, ruleId: "LIVA-96" },
};
