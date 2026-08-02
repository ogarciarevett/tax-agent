---
description: "Stage 11 — build the evidence graph in .ai/specs/99-acceptance.md: requirement → behavior → implementation → test → passing output"
---

# /acceptance — stage 11, the ACCEPTANCE GRAPH

Produce `.ai/specs/99-acceptance.md`. This is graph 4 of four (see `.ai/references/evidence-graph.md`)
and the project-level roll-up of every node's Honest Implementation Report.

**A row is ✅ only with BOTH an implementation pointer AND a passing test — with the proving output
PASTED, not asserted.**

## Steps

1. **Run the gate commands and paste their output**: `pnpm test` (with coverage vs threshold),
   `pnpm exec tsc --noEmit`, `pnpm exec biome check`,
   `node scripts/validate-task-graph.mjs .ai/specs/task-graphs/<id>.json`, and
   `sh scripts/sync-ai-docs.sh` + `git diff --exit-code -- AGENTS.md CLAUDE.md GEMINI.md`.
2. **Fill ONE canonical matrix** — the whole file uses this shape, not three competing ones:

   `| # | Requirement | Behavior | Implementation (file:line) | Test | Evidence | Status |`

   Carry the honest status through from each node's report. **Do not upgrade a status here.**
3. **Add the non-requirement rows** the evidence graph also demands, each with its own evidence:
   invariants · graph delta (planned vs actual, from `/reconcile`) · loop transitions (each node's
   final state) · security boundary · tenancy boundary · documentation · generated-contract
   synchronization.
4. **Report the aggregate Honest Implementation Metric**: `verified ✅ ÷ total = NN%`.
5. **List Unverified and Could-not-do** — never omit either, even when empty (say "none").
   Point every gap at `.ai/specs/98-nice-to-haves.md`.
6. **End with a one-line verdict** (GOAL MET / NOT YET).

## Notes

- Status legend: ✅ done & tested (evidence pasted) · ⚠️ done with a documented limitation ·
  🔧 stubbed/mocked · ❌ not done · 🚫 blocked.
- **Over-claiming is a contract violation.** Under-claiming (⚠️/❌/🚫 with a reason) is correct;
  never mark ✅ without pasted proof, and never invent output to make the matrix look green.
- A reviewer's approval is not evidence. An agent or terminal-pane status (`idle`, `done`,
  `unknown`) is not evidence. Files, diffs, and command output are evidence.
- **Implementation with no requirement is unexplained scope** — trace it or remove it. `/reconcile`
  finds these mechanically.
- This is the evidence step before `/goal` closes the work. `/goal` iterates until this file is
  green; it does not author its own file.
