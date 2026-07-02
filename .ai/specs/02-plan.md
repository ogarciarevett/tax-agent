# 02 — Task backlog & plan (per-task index)

> **Template.** The local backlog: one row per TASK, each running the full per-task lifecycle
> (`/spec → /plan → /build → /test → /review`). Written/updated by `/plan`. If the repo uses an
> external backlog (Linear / GitHub Projects), THAT is the source of truth — keep this file as a
> thin local mirror and use the external ids. Otherwise tasks use local ids `A1, A2, B1, …`
> (letter = feature/epic, number = task) and each has a `.ai/specs/<id>-spec.md`. `✅ = impl +
> passing test, evidence pasted`. Delete this note once filled.

- Status: active
- Backlog source: local (.ai/specs)
- Derives from: [`01-spec.md`](./01-spec.md)

## Task index
| Task id | Title | Spec | Status |
|---------|-------|------|--------|
| A1 | opentui profile interview + local persistence | [`A1-spec.md`](./A1-spec.md) | ✅ shipped — 4/5 AC ✅ (100% cov, 3/3 review); AC#1 ⚠️ live TUI needs a terminal |
| B0 | CLI router + stub commands | [`B0-spec.md`](./B0-spec.md) | ✅ 4/4 AC (gates green, stubs + regression evidence) |
| B1 | Bill domain + AgentRunner seam + migrations + ingest repo | [`B1-spec.md`](./B1-spec.md) | ✅ 5/5 AC (75 tests; legacy DB adopted user_version=2) |
| B2 | Agent-CLI adapter (claude/codex, model+effort) | [`B2-spec.md`](./B2-spec.md) | ✅ 5/5 AC (real `claude -p` smoke PONG; codex stdin `-` pinned) |
| B3 | Scan task prompt + verification + file writer | [`B3-spec.md`](./B3-spec.md) | ✅ 6/6 AC (33 tests; tolerance = ±1c/VAT line) |
| B4 | `es` country module + Spain fixtures | [`B4-spec.md`](./B4-spec.md) | ✅ 5/5 AC (24 tests; 100% cov on module; traceability sweep) |
| B5 | `scan` orchestration + cron wiring | [`B5-spec.md`](./B5-spec.md) | ✅ 5/6 AC (48 ingest tests; cron-context AC awaits the user's crontab install) |
| B6 | Month report renderer + TUI table + `report` cmd | [`B6-spec.md`](./B6-spec.md) | ✅ 4/5 AC (golden renders + real-CLI piped run; TTY q-exit needs a human terminal) |
| B7 | Epic integration + live E2E + consensus review + acceptance | [`B7-spec.md`](./B7-spec.md) | 🔵 gates green · live scan 2 real bills · panel fixes applied |

Status legend: ⬜ todo · 🔵 in progress · ✅ done (impl + passing test) · 🚫 blocked.

---

## Per-task steps
<!-- For each task, decompose into dependency-ordered vertical steps. Each step's Acceptance is
the exact check that proves it — and the row it gets in the /build Honest Implementation Report. -->

### A1 — opentui profile interview + local persistence  ⟸ start here
Files: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`,
`src/domain/profile.ts`, `src/storage/db.ts`, `src/storage/profile-repo.ts`,
`src/tui/interview.ts`, `src/index.ts`, `src/**/*.test.ts`

Each step is a thin vertical slice that ends runnable + green. `AC#n` = A1-spec acceptance criterion.

- **Step 1 — Scaffold a green skeleton.** `package.json` (pnpm; deps `zod`, `better-sqlite3`,
  opentui; dev `typescript`, `vitest` + `@vitest/coverage-v8`, `@biomejs/biome`, `tsx`,
  `@types/node`, `@types/better-sqlite3`); strict `tsconfig.json`; `biome.json`; `vitest.config.ts`
  with v8 coverage; scripts `dev`/`test`/`typecheck`. Trivial `src/index.ts` + one smoke test.
  · **Acceptance:** `pnpm install` ok; `pnpm exec tsc --noEmit`, `pnpm exec biome check`,
  `pnpm test` all green (paste logs). Unblocks AC#5.
- **Step 2 — Profile domain (zod boundary).** `src/domain/profile.ts`: `ProfileSchema`
  (country enum incl `es`, residency status, tax year, filing situation; optional name/NIF),
  `Profile` type, `parseProfile(raw)` helper. · **Acceptance (AC#2):** unit test — valid input →
  `Profile`; invalid (bad country / missing tax year) → schema error with a clear message.
- **Step 3 — SQLite persistence.** `src/storage/db.ts` (open DB at config path, default
  `data/tax-agent.sqlite`, create `profile` table if absent) + `src/storage/profile-repo.ts`
  (`saveProfile`, `loadProfile(): Profile | null`). · **Acceptance (AC#3, AC#4):** unit test on
  `:memory:` — save→load round-trips equal; `loadProfile` on empty DB → `null`; coverage ≥ 80% on
  `src/domain` + `src/storage`.
- **Step 4 — Interview mapping + opentui flow.** `src/tui/interview.ts`: question list + **pure**
  `answersToProfile(answers)` (delegates to `parseProfile`), and the opentui render loop calling
  it. · **Acceptance:** unit test on `answersToProfile` (raw answers → `Profile`; bad answers →
  schema error). Render layer proven by the Step 5 run, not a TTY test.
- **Step 5 — CLI wiring + real run.** `src/index.ts`: on start `loadProfile()`; if present show
  current values for review/edit, else run the interview; then `saveProfile`. Wire the `dev`
  script / bin. · **Acceptance (AC#1, AC#5):** a real run launches the interview and writes a row —
  paste run output + `SELECT * FROM profile`; final `tsc` + `biome check` + `pnpm test` (coverage
  ≥ 80%) all green.

**Ordering & rationale:** 1 unblocks all (nothing typechecks/tests without scaffold). 3 imports
`Profile` from 2 → 2 before 3. 4 depends on 2. 5 depends on 3 + 4. Keep the opentui render thin;
all logic lives in pure functions (2, 4) and the repo (3) so it's testable without a TTY.

---

## Epic B — waves & dependencies
Epic B (daily billing scan via subscription agent-CLI → `~/Downloads/tax-agent/YYYY-MM/` → Spain
table in TUI; approved plan 2026-07-02) executes in four waves:
- **Wave 1 (lead, sequential):** B0 → B1 — shared seams (`src/index.ts`, `src/storage/db.ts`,
  `vitest.config.ts`, `src/domain/`) land once, then freeze.
- **Wave 2 (3 teammates, file-disjoint):** B2 (`src/llm/**`) ∥ B3 (`src/ingest/**` minus
  `scan.ts`) ∥ B4 (`src/countries/**`).
- **Wave 3 (2 teammates):** B5 (`src/ingest/scan.ts`, `src/cli/scan.ts`, `scripts/cron-scan.sh`)
  ∥ B6 (`src/report/**`, `src/tui/table-view.ts`, `src/cli/report.ts`).
- **Wave 4 (lead):** B7 — integrated gates, live E2E, 2-of-3 consensus review, acceptance, local
  commits.

## Parallel-work notes (optional)
A1 is a single small vertical slice with a linear dependency chain (1 → 2 → 3 → 4 → 5) — **do not**
parallelize with an Agent Team; the 3–5× token cost isn't worth it. One focused agent, step by
step. Parallelism becomes worthwhile later when file-disjoint epics exist (e.g. `es` tax-rules
module vs document-ingestion vs the LLM adapter).
