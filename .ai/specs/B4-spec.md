# B4 — `es` country module + Spain fixtures  (per-task spec)

- Task id: B4
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
Spain figures behind the per-country boundary (contract hard rule: country logic never leaks into
shared code): monthly totals, per-IVA-rate breakdown, expense-side quarterly estimates — every
figure structurally traceable to bill ids and cited rules.

## Scope / non-goals
**In scope**
- `src/countries/types.ts` — `FigureSource` (`{kind:"bill",billId}` | `{kind:"rule",ruleId}`),
  `TraceableFigure {label, amountCents, sources}`, `figure()` helper that **throws on empty
  sources** (a number without provenance cannot be constructed), `CountryReport`, `CountryModule`.
- `src/countries/registry.ts` — `getCountryModule(code)`: one-key literal `{es}`.
- `src/countries/es/rules.ts` — cited constants: IVA 21/10/4 (Art. 90.Uno/91 Ley 37/1992),
  deducción Art. 95, exclusiones Art. 96, LIRPF Art. 30 Ley 35/2006, Modelo 303/130 AEAT;
  `KNOWN_IVA_RATES = [21,10,4,0]`; `DEDUCTIBLE_SHARE` per `BillCategory` (meals→0 cite LIVA-96;
  software/telecom/professional_services→1.0 cite LIVA-95; conservative defaults; one audit point).
- `src/countries/es/report.ts` — pure `buildEsReport({bills, profile, year})`: monthly totals ·
  per-rate breakdown · quarterly "IVA soportado deducible T<q> (expense-side only)" + "Gastos
  deducibles T<q> (expense-side only)" · `filingSituation=employed` → deductible share 0 (cited) ·
  EUR-only (excluded bill ids reported as their own figure) · unverified bills annotated.
- `src/countries/es/fixtures.ts` — ~8 synthetic `BillRecord`s: 21% software, 21% hardware,
  10% meals, 4%, mixed-rate 21+10, verified=0, USD (excluded), `other`; golden numbers
  hand-computed in test comments.

**Non-goals** — no income side (honesty limit: full Modelo 303/130 impossible from expenses
alone), no rendering (B6), no NIF validation.

## Acceptance criteria
- [ ] 1. Golden-number tests: monthly totals, per-rate base/vat, deductible amounts under
      `self_employed` vs `employed` — hand-computed expectations with arithmetic in comments
      (contract's Spain-fixture gate).
- [ ] 2. Structural traceability: programmatic assertion over the WHOLE report — every figure's
      `sources` non-empty, every billId exists in input, every ruleId resolves in `ES_RULES`.
- [ ] 3. `figure()` with empty sources throws (unit test).
- [ ] 4. USD bill excluded from sums and reported in the exclusion figure; zero-bill month/quarter
      yields figures with rule-only sources, no NaN.
- [ ] 5. Gates green: `tsc` · `biome` · coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/countries/types.ts` · `src/countries/registry.ts`(+test) ·
`src/countries/es/{rules,report,fixtures}.ts`(+tests).
Consumes `BillRecord` from `src/domain/bill.ts` and `Profile` from `src/domain/profile.ts` (frozen).

## Risks & assumptions
- `DEDUCTIBLE_SHARE` values are a conservative starting point; tests pin the mapping mechanics,
  the constants file is the single legal-accuracy edit point.
