# B0 — CLI router + stub commands  (per-task spec)

- Task id: B0
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B — daily billing scan via subscription agent-CLI → bills to `~/Downloads` → Spain table

## Goal
Turn the single-purpose CLI entry into a subcommand router (`interview` default · `scan` ·
`report [--month YYYY-MM]` · help) so every later B-task lands in its own command file and
`src/index.ts` freezes after this task (parallel teammates never share a file).

## Scope / non-goals
**In scope**
- `src/cli/args.ts` — pure `parseCliArgs(argv, now?)` returning a tagged union
  `{kind: "interview"|"scan"|"report"(+month)|"help"(+error?)}`; zod month validation
  (`^\d{4}-(0[1-9]|1[0-2])$`); current-month default from injected `now`; `usage()` string.
- `src/index.ts` — thin `switch` → `src/cli/{scan,report}.ts`; non-TTY guard only on `interview`;
  keeps the PII-safe DEBUG-gated catch.
- Stubs `src/cli/scan.ts` / `src/cli/report.ts` exporting functions that print "not implemented".
- `vitest.config.ts`: `args.ts` coverage-included; command shells excluded (like `index.ts`).

**Non-goals** — no scan/report behavior (B5/B6), no new deps (plain argv switch).

## Acceptance criteria
- [ ] 1. Unit tests: every subcommand parses; bad `--month` rejected with message; missing month →
      current month from injected `now`; unknown command → help kind with error.
- [ ] 2. `pnpm dev` (no args) still runs the A1 interview unchanged (regression, manual evidence).
- [ ] 3. `pnpm dev report` / `pnpm dev scan` print the stub message and exit 0 (manual evidence).
- [ ] 4. Gates green: `tsc --noEmit` · `biome check` · `pnpm test` coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/cli/args.ts`(+test) · `src/index.ts` · `src/cli/scan.ts` · `src/cli/report.ts` ·
`vitest.config.ts`

## Risks & assumptions
- `index.ts` stays coverage-excluded; all logic lives in `args.ts`.
