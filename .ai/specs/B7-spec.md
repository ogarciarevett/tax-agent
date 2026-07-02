# B7 — Epic integration + live E2E + consensus review + acceptance  (per-task spec)

- Task id: B7
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
Prove the epic end-to-end with a live run, pass the contract's project-level finish line
(consensus review, acceptance matrix, local-only commits), and leave the `.ai/` docs true.

## Scope
- Fill `.ai/specs/01-spec.md` (empty template today): goal, non-goals (no Google API/OAuth, no
  RAG, no PDF originals v1, no filing), flow diagram, module map, data model, trust-boundary
  note, security notes. Re-run `sh scripts/sync-ai-docs.sh`.
- Integrated gates: `pnpm exec tsc --noEmit` · `pnpm exec biome check` · `pnpm test` (≥ 80%).
- Live E2E (user-present): headless `claude -p` Gmail-search proof · real `tax-agent scan`
  (pasted output + `SELECT` rows + `ls ~/Downloads/tax-agent/YYYY-MM/`) · `report` TTY + piped ·
  forced near-term cron firing proving the macOS FDA grant + a `data/logs/cron.log` line.
- `/consensus-review` 2-of-3 panel (code-reviewer + security-auditor + performance-reviewer,
  parallel teammates) → `.ai/specs/03-review.md`; apply findings (`/code-simplify`).
- Conventional, atomic LOCAL commits (NEVER push). `/acceptance` → `.ai/specs/99-acceptance.md`
  traceability matrix aggregating every B-task's Honest Implementation Report.
- Record deferred items in `98-nice-to-haves.md`; append build errors to `.ai/memory.md`.

## Acceptance criteria
- [ ] 1. All gates green on the integrated tree (pasted logs).
- [ ] 2. Live scan writes ≥ 1 real bill row + .md file (pasted evidence; 🚫 if inbox has none —
      then fixture-driven full-pipeline run pasted instead, honestly labeled).
- [ ] 3. 2-of-3 reviewer APPROVE recorded in `03-review.md`.
- [ ] 4. `99-acceptance.md` matrix: requirement → file:line → test → status, with Honest
      Implementation Metric per task; Unverified + Could-not-do lists present.
- [ ] 5. Local `git log` shows atomic conventional commits; working tree clean; nothing pushed.

## Risks & assumptions
- Cron FDA grant + live-inbox content require the user; those rows may honestly land ⚠️/🚫.
