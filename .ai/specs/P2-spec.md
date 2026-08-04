# P2 — Feature eval catalogue with four-surface proof  (per-task spec)

- Task id: **P2**
- Status: **APPROVED** (human requested this work directly, 2026-08-04)
- Backlog source: **local (`.ai/specs`)** — unchanged from P1; `gh` still lacks `read:project`.
- Financially material: **no** · Changes the operating contract: **yes**
  → mandatory panel: `code-reviewer` · `graph-consistency-reviewer` · `loop-correctness-reviewer` · `security-auditor`
- Traces up to: [`01-spec.md`](./01-spec.md) · Indexed in: [`02-plan.md`](./02-plan.md)
- Task graph: [`task-graphs/P2.json`](./task-graphs/P2.json)

## Goal

Give every feature an eval that proves it across four surfaces — **UI, backend log, DB rows, and
returned output** — and make running them a pipeline stage, so a feature whose unit tests pass but
which is invisible in the log or the database cannot be reported as done.

## Scope / non-goals

**In scope:** `EVALS.md` (feature table + eval definitions + the four-surface rule), a zero-dependency
runner (`scripts/run-evals.mjs`, `pnpm eval`), the `/eval` command, and wiring into `.ai/pipeline.md`
(stage 7b), the Definition of Done, `/spec`, `/test` and `/acceptance`.

**NOT in scope:** implementing any platform feature. P1–P14 evals are **specifications** and report
`⬜ not-implemented`. No product code; `src/**` stays frozen.

## Acceptance criteria (each MUST be testable)

- [ ] 1. `EVALS.md` exists with a feature table (input / output / expected) covering the 7 shipped
      Legacy v0 features and the 14 specified platform features.
- [ ] 2. Every eval accounts for all four surfaces; a missing surface is a hard failure in the runner.
- [ ] 3. `pnpm eval` runs, prints the four-surface matrix, and exits 0 when all asserted surfaces pass.
- [ ] 4. `blocked` and `not-implemented` surfaces never count as passing and never affect the exit code.
- [ ] 5. The runner binds surfaces to existing tests / real CLI runs rather than reimplementing
      assertions (no second source of truth).
- [ ] 6. `/eval` exists as stage 7b and the Definition of Done requires runnable evals green.
- [ ] 7. `/spec` requires an eval row for every new feature.
- [ ] 8. `src/**` unchanged.

## Invariants

| Invariant | Test that would catch a violation |
|-----------|-----------------------------------|
| A surface is never silently omitted | runner emits `MISSING ❌` and fails |
| A not-implemented feature is never reported as passing | `⬜` excluded from the asserted pass rate |
| Evals do not duplicate test assertions | surfaces reference test files by path |
| Legacy v0 stays frozen and green | `git diff --name-status -- src/` empty; `pnpm test` |

## Tenancy & security boundaries

**n/a — no tenant-scoped data.** The runner spawns `pnpm exec vitest` and `pnpm exec tsx` with fixed
argument lists (no shell), and reads no user input.

## Data classification

**Public.** Catalogue, runner, and command docs. The runner asserts *absence* of PII in log output;
it never prints financial values.

## Graph delta (intended)

Task execution graph: 4 nodes. Financial domain graph: none. Evidence graph: gains a per-feature
four-surface row consumed by `/acceptance`.

## Affected loops

None of the node-loop transitions change. `/eval` adds a gate between `/test` and
`/consensus-review`; a failing asserted surface returns the node to `IMPLEMENTING` like any other
gate failure.

## Blast radius

Creates `EVALS.md`, `scripts/run-evals.mjs`, `.ai/commands/eval.md`, `.ai/specs/{P2-spec.md,
task-graphs/P2.json}`. Modifies `.ai/pipeline.md`, `.ai/context.md`, `.ai/commands/{spec,test,
acceptance}.md`, `.ai/specs/02-plan.md`, `package.json`. Regenerates `AGENTS.md` + stubs.
Untouched: `src/**`, `scripts/sync-ai-docs.sh`, `scripts/validate-task-graph*.mjs`, `.githooks/**`.

## Risks & assumptions

- **Highest risk:** the four-surface rule pressures an agent to fabricate a UI assertion for a
  headless command. Mitigated by making `n/a: <reason>` a first-class, expected answer and by
  failing only on *omission*.
- **Assumption:** binding surfaces to existing test files is better than re-asserting in the runner.
  The trade-off is coarser granularity (file-level, not case-level) for zero duplication.

## Open decisions

None. The one judgment call — "account for all four" rather than "assert all four" — is recorded in
`EVALS.md` with its reasoning, and is the honest reading of the request under this repo's
anti-fabrication rules.
