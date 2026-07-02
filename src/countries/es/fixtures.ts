import type { BillCategory, BillRecord, VatLineCents } from "../../domain/bill";

// Nine synthetic bills spanning Q2/Q3 2026 — the golden set for the ES report tests. Every amount
// is hand-checked in the comments (base + IVA = total; money is integer cents throughout). No real
// PII: vendors and ids are invented.

interface FixtureSpec {
	readonly id: number;
	readonly category: BillCategory;
	readonly issueDate: string;
	readonly totalCents: number;
	readonly vatLines: readonly VatLineCents[];
	readonly currency?: string;
	readonly verified?: boolean;
}

function makeBill(spec: FixtureSpec): BillRecord {
	return {
		id: spec.id,
		emailId: spec.id,
		gmailMessageId: `fixture-${spec.id}`,
		vendor: "Proveedor Ejemplo SL",
		issueDate: spec.issueDate,
		receivedDate: spec.issueDate,
		currency: spec.currency ?? "EUR",
		totalCents: spec.totalCents,
		vatLines: spec.vatLines,
		category: spec.category,
		filePath: `data/fixtures/${spec.id}.eml`,
		sourceQuote: "Importe total según factura.",
		extractor: "fixture",
		verified: spec.verified ?? true,
		extractedAt: "2026-07-01T00:00:00.000Z",
	};
}

export const ES_FIXTURES: readonly BillRecord[] = [
	// id 1 — software 21% (deductible 100%): base 1000,00 + IVA 210,00 = 1210,00
	makeBill({
		id: 1,
		category: "software",
		issueDate: "2026-07-05",
		totalCents: 121000,
		vatLines: [{ ratePct: 21, baseCents: 100000, vatCents: 21000 }],
	}),
	// id 2 — telecom 21% (deductible 100%): base 50,00 + IVA 10,50 = 60,50
	makeBill({
		id: 2,
		category: "telecom",
		issueDate: "2026-07-10",
		totalCents: 6050,
		vatLines: [{ ratePct: 21, baseCents: 5000, vatCents: 1050 }],
	}),
	// id 3 — meals 10% (NON-deductible, LIVA-96): base 40,00 + IVA 4,00 = 44,00
	makeBill({
		id: 3,
		category: "meals",
		issueDate: "2026-07-12",
		totalCents: 4400,
		vatLines: [{ ratePct: 10, baseCents: 4000, vatCents: 400 }],
	}),
	// id 4 — utilities 21% (deductible 100% here; prorrata may apply): base 80,00 + IVA 16,80 = 96,80
	makeBill({
		id: 4,
		category: "utilities",
		issueDate: "2026-07-15",
		totalCents: 9680,
		vatLines: [{ ratePct: 21, baseCents: 8000, vatCents: 1680 }],
	}),
	// id 5 — professional_services, MIXED rates (deductible 100%):
	//   (base 100,00 + IVA 21,00 @21%) + (base 20,00 + IVA 2,00 @10%) = total 143,00; IVA 23,00
	makeBill({
		id: 5,
		category: "professional_services",
		issueDate: "2026-07-20",
		totalCents: 14300,
		vatLines: [
			{ ratePct: 21, baseCents: 10000, vatCents: 2100 },
			{ ratePct: 10, baseCents: 2000, vatCents: 200 },
		],
	}),
	// id 6 — hardware 21% (deductible 100%), UNVERIFIED: base 200,00 + IVA 42,00 = 242,00
	makeBill({
		id: 6,
		category: "hardware",
		issueDate: "2026-07-25",
		totalCents: 24200,
		vatLines: [{ ratePct: 21, baseCents: 20000, vatCents: 4200 }],
		verified: false,
	}),
	// id 7 — software in USD → EXCLUDED from every sum; 500,00 USD, surfaced as an exclusion figure
	makeBill({
		id: 7,
		category: "software",
		issueDate: "2026-07-28",
		totalCents: 50000,
		vatLines: [],
		currency: "USD",
	}),
	// id 8 — other 21% (NON-deductible), dated 2026-06-30 → Q2 (T2), NOT Q3: base 30,00 + IVA 6,30
	makeBill({
		id: 8,
		category: "other",
		issueDate: "2026-06-30",
		totalCents: 3630,
		vatLines: [{ ratePct: 21, baseCents: 3000, vatCents: 630 }],
	}),
	// id 9 — office_supplies 4% superreducido (deductible 100%), dated 2026-04 → Q2, away from the
	//         Q3/July golden set: base 250,00 + IVA 10,00 = 260,00
	makeBill({
		id: 9,
		category: "office_supplies",
		issueDate: "2026-04-15",
		totalCents: 26000,
		vatLines: [{ ratePct: 4, baseCents: 25000, vatCents: 1000 }],
	}),
];
