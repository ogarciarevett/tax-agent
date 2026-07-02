# B6 — Month report renderer + TUI table + `report` command  (per-task spec)

- Task id: B6
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
The user-facing answer: `tax-agent report [--month YYYY-MM]` shows a small table — per-bill rows
(vendor, date, amount, IVA), month totals, and the `es` summary (how much to pay, expense-side) —
in an opentui view on a TTY and as plain stdout otherwise.

## Scope / non-goals
**In scope**
- `src/report/render-month-table.ts` — pure `renderMonthTable(month, bills, esReport): string`:
  padded columns · cents → es-ES `€ 1.234,56` formatting (no floats: integer division + padStart) ·
  Total row · es block with `[rule …]` citations per line · annotations for `verified=0` (`~`)
  and `adjunto pendiente de descarga manual` · empty month → "Sin facturas en YYYY-MM." (all
  user-facing table text is Spanish). Golden-string tests; coverage-INCLUDED.
- `src/tui/table-view.ts` — `showTable(text): Promise<void>`: `createCliRenderer` +
  one `TextRenderable` (the pre-rendered string), resolve on `q`/Esc/Ctrl-C. TTY-only,
  coverage-excluded (same policy as `opentui-prompter.ts`).
- `src/cli/report.ts` — fill the B0 stub: load profile + bills for month →
  `getCountryModule(profile.country).buildReport(...)` → render; TTY → `showTable`,
  non-TTY → `console.log` (same string, works for cron/pipes).

**Non-goals** — no interactive month navigation (re-run with `--month`), no CSV/PDF export.

## Acceptance criteria
- [ ] 1. Golden-string tests: populated month (alignment, totals, es citations), empty month,
      unverified + attachment-pending annotations, long-vendor truncation.
- [ ] 2. es-ES money formatting from integer cents only (unit test: 123456 → `1.234,56 €` form).
- [ ] 3. Manual TTY run: `pnpm dev report` shows the opentui table, `q` exits cleanly
      (pasted evidence/screenshot description).
- [ ] 4. Piped run prints the same table text (`pnpm dev report | cat`, pasted).
- [ ] 5. Gates green: `tsc` · `biome` · coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/report/render-month-table.ts`(+test) · `src/tui/table-view.ts` · `src/cli/report.ts`.
Consumes B1 repo (`listBillsForMonth`) + B4 `CountryReport`.

## Risks & assumptions
- opentui API assumed from the existing prompter's usage — reuse its renderer setup verbatim.
