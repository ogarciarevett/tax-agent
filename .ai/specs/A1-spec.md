# A1 — opentui profile interview + local persistence  (per-task spec)

- Task id: A1
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Requirements: [`00-requirements.md`](./00-requirements.md)

## Goal
A runnable CLI that opens an **opentui** interview collecting the user's core tax profile
(country, residency status, tax year, filing situation), validates every answer with **zod**, and
persists the profile to a local **SQLite** DB under `data/`. Re-running loads the existing profile
for review/edit instead of starting blank. This is the foundation slice — no documents, RAG, cron,
LLM, or reports yet.

## Scope / non-goals
**In scope**
- Minimal project scaffold needed to run: `package.json`, strict `tsconfig.json`, `biome.json`,
  `vitest.config.ts`, a `dev`/`test`/`typecheck` script.
- A zod `ProfileSchema` (the validated boundary) + `Profile` type.
- SQLite persistence (better-sqlite3) with a `profile` table and save/load round-trip.
- opentui interview flow that maps answers → a validated `Profile`.
- Load-existing-on-startup: seeded profile is shown for review rather than re-asked.

**Non-goals (deferred to later tasks)**
- No document ingestion / bill scanning · no RAG / sqlite-vec (structured profile needs no
  vectors yet) · no cron · no LLM calls (interview is deterministic Q&A) · no report generation ·
  no Spain tax-rule logic. The `es` per-country module is a later task.

## Acceptance criteria (each MUST be testable)
- [ ] 1. Running the CLI launches the opentui interview and, on completion, writes a profile row
      to the local SQLite DB under `data/` (evidence: run output + `SELECT` showing the row).
- [ ] 2. The profile is validated by `ProfileSchema` at the boundary; invalid input is rejected
      with a clear message (unit test: bad input → schema error; good input → parsed `Profile`).
- [ ] 3. Re-launch with an existing profile loads it and presents current values for review/edit,
      not a blank interview (unit test: seeded DB → `loadProfile` returns the stored profile).
- [ ] 4. Persistence + schema modules have unit tests (save→load round-trip against a temp/`:memory:`
      DB), coverage ≥ 80% on those modules.
- [ ] 5. `pnpm exec tsc --noEmit`, `pnpm exec biome check`, and `pnpm test` all pass (pasted logs).

## Interfaces / data touched
- Scaffold: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`
- `src/domain/profile.ts` — zod `ProfileSchema` + `Profile` type
- `src/storage/db.ts` — SQLite connection (path from config; default `data/tax-agent.sqlite`)
- `src/storage/profile-repo.ts` — `saveProfile(p)` / `loadProfile(): Profile | null`
- `src/tui/interview.ts` — opentui flow + pure `answersToProfile()` mapper
- `src/index.ts` — CLI entry: load-or-interview → validate → save
- `src/**/*.test.ts` — vitest
- `profile` table: single logical record (carries an `id` for future multi-profile; code assumes one)

## Risks & assumptions
- **opentui API is assumed from its docs**; the render layer is the least testable. Mitigation:
  keep the question list + `answersToProfile()` mapping as a **pure function** separate from
  opentui rendering, so tests never need a TTY. The rendered TUI itself is verified by a manual run
  (evidence), not a unit test.
- **better-sqlite3 is a native module** (needs a build on Node 22). Assumed installable. If it
  fails, fallback = a JSON-file store behind the same `profile-repo` interface — interface-first
  keeps the swap cheap. <!-- ponytail: named ceiling + upgrade path -->
- **Single-user**: one logical profile; the `id` column is forward-compat only.
