import type { AgentScanReport } from "../domain/bill";

// Canned agent replies for the B3 tests. Built from typed objects then serialised, so they always
// match the frozen contract in src/domain/bill.ts. None contain real personal data.

// Two bills: a mixed-rate (21% + 10%) bill written in Spanish "1.234,56" style whose lines sum
// exactly to the total, and a no-VAT bill in English "49.99" style. Plus one attachment-only bill
// and one non-bill. Every printed amount also appears in the source text, so both bills verify.
const VALID_REPORT: AgentScanReport = {
	bills: [
		{
			gmailMessageId: "msg-acme-01",
			receivedDate: "2026-06-18",
			vendor: "Acme SL",
			issueDate: "2026-06-15",
			currency: "EUR",
			total: "1.234,56",
			vatLines: [
				{ ratePct: 21, base: "1.000,00", vat: "210,00" },
				{ ratePct: 10, base: "22,33", vat: "2,23" },
			],
			category: "professional_services",
			sourceQuote: "Factura Acme — Total: 1.234,56 EUR (IVA incluido)",
			bodyMarkdown:
				"## Factura Acme SL\n\n| Base | Tipo | IVA |\n| --- | --- | --- |\n| 1.000,00 | 21% | 210,00 |\n| 22,33 | 10% | 2,23 |\n\n**Total: 1.234,56 EUR**",
		},
		{
			gmailMessageId: "msg-globex-02",
			receivedDate: "2026-06-20",
			vendor: "Globex Inc",
			issueDate: null,
			currency: "USD",
			total: "49.99",
			vatLines: [],
			category: "software",
			sourceQuote: "Globex invoice — amount due 49.99 USD",
			bodyMarkdown: "# Globex\n\nAmount due 49.99 USD. Thank you.",
		},
	],
	attachmentOnly: [
		{
			gmailMessageId: "msg-endesa-03",
			receivedDate: "2026-06-19",
			vendor: "Endesa",
		},
	],
	notBills: ["msg-newsletter-04"],
	hasMore: false,
};

/** A single bill whose total (1.000,00) never appears in its quote/body — the agent inflated it. */
const FABRICATED_TOTAL_REPORT: AgentScanReport = {
	bills: [
		{
			gmailMessageId: "msg-fake-01",
			receivedDate: "2026-06-21",
			vendor: "Fantasma SL",
			issueDate: "2026-06-21",
			currency: "EUR",
			total: "1.000,00",
			vatLines: [],
			category: "other",
			sourceQuote: "Su pedido por 10,00 EUR ha sido confirmado. ¡Gracias!",
			bodyMarkdown: "Detalle: 1 artículo.",
		},
	],
	attachmentOnly: [],
	notBills: [],
	hasMore: false,
};

/** Total is quoted (121,00) but base+vat (100,00 + 20,98 = 120,98) is 2 cents short — one VAT line,
 * so the tolerance is 1 cent and the bill is rejected as an arithmetic mismatch. */
const ARITHMETIC_MISMATCH_REPORT: AgentScanReport = {
	bills: [
		{
			gmailMessageId: "msg-mismatch-01",
			receivedDate: "2026-06-22",
			vendor: "Descuadre SL",
			issueDate: "2026-06-22",
			currency: "EUR",
			total: "121,00",
			vatLines: [{ ratePct: 21, base: "100,00", vat: "20,98" }],
			category: "office_supplies",
			sourceQuote: "Total a pagar: 121,00 EUR",
			bodyMarkdown: "Base: 100,00 — IVA: 20,98 — Total: 121,00",
		},
	],
	attachmentOnly: [],
	notBills: [],
	hasMore: false,
};

export const VALID_REPLY = JSON.stringify(VALID_REPORT, null, 2);

export const FENCED_REPLY = `Sure — here is the scan result:

\`\`\`json
${VALID_REPLY}
\`\`\`

Let me know if you need anything else.`;

// A syntactically valid JSON reply that fails the contract: total "" is not a printed amount. Used
// with VALID_REPLY as the invalid→valid retry pair.
export const INVALID_REPLY = JSON.stringify({
	bills: [
		{
			gmailMessageId: "msg-bad-01",
			receivedDate: "2026-06-23",
			vendor: "Rota SL",
			issueDate: null,
			currency: "EUR",
			total: "",
			vatLines: [],
			category: "other",
			sourceQuote: "Total: ??? EUR",
			bodyMarkdown: "Importe ilegible.",
		},
	],
	attachmentOnly: [],
	notBills: [],
	hasMore: false,
});

export const INVALID_THEN_VALID: readonly [string, string] = [
	INVALID_REPLY,
	VALID_REPLY,
];

export const FABRICATED_TOTAL_REPLY = JSON.stringify(FABRICATED_TOTAL_REPORT);
export const ARITHMETIC_MISMATCH_REPLY = JSON.stringify(
	ARITHMETIC_MISMATCH_REPORT,
);
