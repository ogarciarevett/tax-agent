---
description: Stage 7b — run the EVALS.md catalogue and prove each feature across all four surfaces (UI, backend log, DB, output)
---

# /eval — stage 7b, the four-surface feature gate

Run `EVALS.md` and write `.ai/specs/95-eval-results.md`.

`/test` proves the *code* works (unit, integration, invariants). `/eval` proves the *feature* works
**where a user and an operator can see it** — screen, log, database, returned artifact. A feature
whose tests pass but whose row never appears in a log or a table is not shipped, it is compiled.

## Steps

1. **Run it and paste the output:**
   ```sh
   pnpm eval            # the four-surface matrix
   pnpm eval --json     # machine-readable, embed in the report
   ```
2. **Read the matrix.** Every eval prints four columns. Each is `assert` / `n/a: <reason>` /
   `blocked: <reason>` / `not-implemented`.
3. **Fail on any asserted surface that failed.** `blocked` and `not-implemented` do **not** fail the
   run — and do **not** count as passing either. Never convert one into the other to make the table
   look green.
4. **Write `.ai/specs/95-eval-results.md`**: the matrix, the notes, the asserted pass rate, and the
   explicit count of not-implemented features.
5. **Feed `/acceptance`.** Each eval row becomes an evidence row in the acceptance graph.

## The four-surface rule

**Every eval accounts for all four surfaces; not every eval can assert all four.** A missing surface
is a hard failure in the runner (`MISSING ❌`) — silence is never allowed. But a headless command
has no UI, and inventing a UI assertion for it would be fabricated evidence, which this contract
forbids more strongly than it wants a full row. Use `n/a` with a reason.

| Surface | Legacy v0 | Platform |
|---|---|---|
| UI | opentui (`src/tui/`) | Next.js RSC |
| LOG | `console.log` via the `ScanLog` sink; `data/logs/cron.log` | OpenTelemetry + structured logs |
| DB | SQLite `profile` / `emails` / `bills` | PostgreSQL |
| OUT | stdout string, written `.md`, exit code | API response |

## Rules

- **A new feature is not done until it has an eval row in `EVALS.md`** with all four surfaces
  accounted for. `/spec` must add it; `/build` must make it pass.
- **Never assert a surface the feature does not have.** `n/a: <reason>` is the correct, expected
  answer for a pure module or a headless command.
- **Platform evals (P1–P14) are specifications.** They report `⬜` until the phase that builds them.
  They must never be reported as passing, and they never enter the pass rate.
- Evals bind to existing tests and real CLI runs. Do not reimplement assertions in the runner — that
  creates a second source of truth that drifts from the suite.
