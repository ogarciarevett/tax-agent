# P1 — Define and self-host the graph-orchestrated loop pipeline  (per-task spec)

- Task id: **P1**
- Status: **APPROVED** (human approval received 2026-08-02, before implementation)
- Backlog source: **local (`.ai/specs`)**. Detection run 2026-08-02: `gh project list` →
  `error: your authentication token is missing required scopes [read:project]`
  (**undetermined, not absent**); `LINEAR_API_KEY` unset; this repo's `.mcp.json` configures only
  `excalidraw` — a user-level connector the repo does not configure does not count.
  Therefore the local letter+number scheme applies.
- Financially material: **no** · Changes the operating contract: **yes**
  → mandatory reviewer panel: `code-reviewer` · `graph-consistency-reviewer` ·
  `loop-correctness-reviewer` · `security-auditor`
- Traces up to: [`01-spec.md`](./01-spec.md) · Indexed in: [`02-plan.md`](./02-plan.md)
- Task graph: [`task-graphs/P1.json`](./task-graphs/P1.json)

> **Why `P1` and not `A1`.** The originating instruction proposed `A1`. `A1` is already taken by the
> shipped opentui profile-interview task (`.ai/specs/A1-spec.md`, commit `416bc34`); reusing it
> would overwrite shipped history and orphan its acceptance rows. `P` opens a new epic for
> pipeline/platform contract work. Confirmed with the human before implementation.

## Goal

Replace the repository's linear, prose-driven lifecycle with **Pipeline V2** — a graph-orchestrated,
loop-engineered, evidence-gated pipeline — and prove it by running it against its own bootstrap
task, so the machinery that will later build financially material code is itself specified,
reviewed, and validated before it is trusted with money.

## Scope / non-goals

**In scope:** the operating contract (`.ai/context.md`), the lifecycle (`.ai/pipeline.md`), the
task-graph schema and its validator, the evidence-graph and loop-state-machine references, two new
commands (`/map`, `/reconcile`) and updates to ten existing ones, two new reviewer personas, four
new skills, four ADRs, the specs scaffolding, a blocking test gate, and a README that represents the
actual project.

**Added by amendment (see "Amendments" below):** `vitest.config.ts` (test-discovery scope) and
`.gitignore` (PII containment).

**Explicitly NOT in scope:**
- Any application code, database schema, migration, Next.js app, or UI. **P0 records and validates
  the contract; it builds no product.**
- Any change to `src/**`. The Legacy CLI v0 is frozen and must remain green.
- The five deferred skills and two deferred financial personas (see `98-nice-to-haves.md`) — they
  govern code that does not exist; writing them now produces aspirational documentation.
- CI. No `.github/` exists and adding one is out of P0 scope.
- Pushing, opening a PR, or touching any remote.

## Acceptance criteria (each MUST be testable)

- [ ] 1. `sh -n scripts/sync-ai-docs.sh` exits 0.
- [ ] 2. `sh scripts/sync-ai-docs.sh` regenerates the contract; a **second** run introduces no
      further change (idempotence proven by diff).
- [ ] 3. `AGENTS.md` reflects the new `.ai/context.md` + `.ai/pipeline.md`; `CLAUDE.md` and
      `GEMINI.md` remain `@AGENTS.md` stubs. No generated file was hand-edited.
- [ ] 4. `node scripts/validate-task-graph.test.mjs` passes, proving the validator detects a cycle,
      an evidence-free `VERIFIED` node, and a write-set overlap.
- [ ] 5. `node scripts/validate-task-graph.mjs .ai/specs/task-graphs/P1.json` passes: no cycles,
      every dependency resolves, every node explained and checkable.
- [ ] 6. `node scripts/validate-task-graph.mjs --reconcile .ai/specs/task-graphs/P1.json` reports
      **no unexplained scope** — every changed file is in a declared `write_set`.
- [ ] 7. The Legacy CLI stays green: `pnpm test` (≥80% coverage), `pnpm exec tsc --noEmit`,
      `pnpm exec biome check`.
- [ ] 8. `git diff --name-status -- src/` is **empty** — proving no product code was created.
- [ ] 9. No unresolved template placeholder remains in a committed contract file (outside the
      bootstrap/template files that legitimately document placeholders).
- [ ] 10. Every `agent-skills:` reference in `.ai/commands/` resolves to an existing
      `.ai/skills/<name>/SKILL.md`; every persona referenced exists; every new reference path exists.
- [ ] 11. `/ship` and `/consensus-review` no longer contradict each other on fan-out ownership, and
      `agents/README.md` + `references/orchestration-patterns.md` agree with them.
- [ ] 12. A blocking pre-commit test gate exists and is syntactically valid
      (`sh -n .githooks/pre-commit.d/20-test.sh`).
- [ ] 13. `git diff --check` clean and `git status --short` clean at close; commits are local only.
- [ ] 14. `.ai/specs/99-acceptance.md` carries a complete evidence path per criterion, and the
      Honest Implementation Report lists Unverified, Could-not-do, and bootstrap exceptions.
- [ ] 15. **(Amendment A1)** The known PII scratch paths are **ignored for ordinary `git add`**:
      `git check-ignore -v tmp/pdfs/renta-pago.txt` and `git check-ignore -v data/` both resolve to a
      `.gitignore` rule, and `git ls-files -- data tmp` is empty.
      **This is containment, not prevention** — `git add -f` still stages an ignored file, and PII
      under an unlisted name is unaffected. A fail-closed staged-content gate is deferred
      (`98-nice-to-haves.md`).
- [ ] 17. **(Amendment A3)** The lint and typecheck pre-commit hooks fail closed on a missing
      toolchain, like the test gate: `grep -c 'exit 1' .githooks/pre-commit.d/10-biome.sh
      .githooks/pre-commit.d/30-typecheck.sh` is non-zero for both.
- [ ] 16. **(Amendment A2)** `pnpm test` stays green with the validator's standalone `.mjs` self-test
      present — vitest discovery is scoped to `src/` and the self-test runs via `pnpm test:graph`.

## Amendments (post-approval scope changes — require human ratification)

Recorded here rather than in the task graph, because **the graph may never be the place a scope
change is first written down** (`.ai/references/task-graph-schema.md` → precedence rule). Both were
surfaced mid-task by the pipeline's own gates and are pending the human's ratification.

| # | Amendment | Why | Raised by | Status |
|---|-----------|-----|-----------|--------|
| **A1** | `.gitignore` added to P1.N13's write set; criterion **AC15** added | `tmp/pdfs/` held 10 Spanish income-tax payment files (`renta-pago*.png/.txt`, dated 2026-07-22) **untracked and unignored** — one `git add -A` from being committed, in violation of the hard rule that PII never enters git. Files were ignored, **not deleted**. | `node scripts/validate-task-graph.mjs --reconcile` (after the `-uall` fix) | ⚠️ **awaiting human ratification** |
| **A3** | `.githooks/pre-commit.d/{10-biome,30-typecheck}.sh` added to P1.N10's write set; criterion **AC17** added | Both soft-skipped on a missing `pnpm` (`\|\| exit 0`), so the DoD's "linter clean" and "typecheck clean" passed silently — the same advisory-gate defect `20-test.sh` was created to fix. | second `security-auditor` seat (M4) | ⚠️ **awaiting human ratification** |
| **A2** | `vitest.config.ts` added to P1.N9's write set; criterion **AC16** added | Adding `scripts/validate-task-graph.test.mjs` broke `pnpm test`: vitest's default discovery matched it and failed on its top-level `process.exit`. `vitest.config.ts` set only `coverage.include`, never `test.include`. | `pnpm test` failing | ⚠️ **awaiting human ratification** |

Neither amendment changes the pipeline's behavior; both are containment fixes forced by defects the
task itself exposed. They are flagged rather than silently absorbed because an agent may not approve
its own scope change.

## Invariants

| Invariant | Test that would catch a violation |
|-----------|-----------------------------------|
| Generated files change only as a consequence of `.ai/` changes | `sh scripts/sync-ai-docs.sh && git diff --exit-code -- AGENTS.md CLAUDE.md GEMINI.md` |
| The sync is idempotent | two consecutive runs, second produces no diff |
| The task graph is acyclic and fully resolved | `node scripts/validate-task-graph.mjs` |
| No `VERIFIED` node has empty evidence | `node scripts/validate-task-graph.test.mjs` (AC2 case) |
| `parallel_safe` is never authored | validator rejects a non-null value in source |
| No changed file falls outside every `write_set` | `--reconcile` |
| Legacy v0 remains green and untouched | `pnpm test` + `git diff --name-status -- src/` |
| The contract claims no gate it cannot enforce | `20-test.sh` exists and blocks; hardness audit in `99-acceptance.md` |
| Per-tool mirrors never become tracked | `.githooks/pre-commit` `TRACKED_MIRRORS` guard |

## Tenancy & security boundaries

**n/a — no tenant-scoped data.** P1 touches no runtime data path, no database, and no user input.
The only security-relevant surfaces are: the pre-commit hooks (which execute during commit) and
`scripts/validate-task-graph.mjs` (which shells out to `git` via `execFileSync` with a fixed
argument list, no shell interpolation, and reads only files named on the command line). No secrets,
no network, no PII.

## Data classification

**Public.** All P1 artifacts are repository documentation, scripts, and configuration intended to be
committed. No PII, no financial facts, no derived figures.

## Graph delta (intended)

- **Financial domain graph (graph 3):** none. Not implemented in P0.
- **Task execution graph (graph 2):** introduces the artifact type itself —
  `.ai/specs/task-graphs/<id>.json`, schema v1.0 — plus this task's own 16 nodes and their edges.
- **Repository reality graph (graph 1):** invalidated by this task; re-run `/map` rather than
  trusting any cached scan.
- **Evidence graph (graph 4):** introduces the canonical matrix defined in
  `.ai/references/evidence-graph.md`.

Node/edge detail is in `task-graphs/P1.json`; it is not duplicated here, because a second copy is
exactly the drift the graph exists to prevent.

## Affected loops

The **node loop** is defined by this task — `PROPOSED → READY → IMPLEMENTING → TESTED → REVIEWED →
RECONCILED → VERIFIED`, plus `BLOCKED`, `TEST_FAILED`, `REVIEW_FAILED`, `GRAPH_DRIFT`,
`INVARIANT_FAILED`, `SUPERSEDED`. See `.ai/references/loop-state-machines.md`.

Product loops: none — no product exists.

## Blast radius

Verified by direct inspection on 2026-08-02:

- **Direct writes (46 files, confirmed by `git status --short -uall | wc -l`):** `.ai/context.md`,
  `.ai/pipeline.md`, 12 in `.ai/commands/`, 3 in `.ai/agents/`, **4** in `.ai/references/`
  (`task-graph-schema`, `evidence-graph`, `loop-state-machines` from N4 + `orchestration-patterns`
  from N8), 5 in `.ai/skills/`, 7 in `.ai/specs/`, 4 in `docs/adr/`, 2 in `scripts/`, 1 in
  `.githooks/pre-commit.d/`, `package.json`, `README.md`, `.ai/memory.example.md`, plus the two
  amendment files `vitest.config.ts` and `.gitignore`.
- **Transitively regenerated:** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` (committed);
  `.ai/generated/rules.mdc`, `.cursor/rules/00-context.mdc`, `.claude/{commands,agents,skills}`,
  `.gemini/*`, `.opencode/*` (gitignored) — all by `scripts/sync-ai-docs.sh:104-201`.
- **Gated by:** `.githooks/pre-commit:25-36` (sync drift on the three committed entry files) and
  `:40-46` (mirrors must not become tracked).
- **Not touched:** `src/**` (2,892 source LOC + 2,456 test LOC), `scripts/sync-ai-docs.sh`,
  `tsconfig.json`, `biome.json`, `.gitattributes`, `.mcp.json`, the existing `.githooks/pre-commit`
  and `post-commit` dispatchers, and all 27 pre-existing skills.
  *(`vitest.config.ts` and `.gitignore` were originally listed here; both moved into scope under
  amendments A2 and A1 — see "Amendments". This line was wrong until the graph-consistency reviewer
  caught it.)*
- **Existing invariants in the touched area:** `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` are generated and
  `linguist-generated=true` (`.gitattributes:10-12`); the generator is deterministic with no
  timestamps (`scripts/sync-ai-docs.sh:30-31`); `.ai/` must stay language-agnostic
  (`.ai/context.md`, source-of-truth section).

## Interfaces / data touched

- **New CLI surface:** `node scripts/validate-task-graph.mjs [--ready|--reconcile [--base <ref>]] <graph.json>...`
  (exit 0 valid, 1 violation, 2 usage). `pnpm test:graph`, `pnpm graph:validate`.
- **New committed artifact type:** `.ai/specs/task-graphs/<id>.json`, schema v1.0.
- **New hook:** `.githooks/pre-commit.d/20-test.sh` (blocking).
- No runtime interfaces, no schemas, no migrations, no env vars.

## Risks & assumptions

- **Highest-risk decision:** adding ceremony (a compiled graph per task) to a repo with no product
  code in the target stack. Mitigated by holding scope to the stated minimum, deferring five skills
  and two personas with reasons, writing exactly one script, and stating explicitly in
  `graph-orchestrated-delivery` that the skill must not be used for trivial changes.
- **Assumption:** the human pushes; nothing here pushes. Enforced by the hard rules.
- **Trade-off accepted:** `AGENTS.md` grows, and it is inlined into every session's context. The
  cost is real; the alternative is a contract that does not state its own rules.
- **Known bootstrap circularity:** see below.

## Bootstrap exceptions (stated, not hidden)

Pipeline V2 **did not govern its own creation.** Specifically:

1. The Pipeline V2 Proposal that preceded this work was produced under the *previous* contract and
   is labelled `BOOTSTRAP — PRE-PIPELINE-V2`.
2. This spec and `task-graphs/P1.json` were authored under the previous contract; the graph is
   therefore partly a post-hoc record, and carries `bootstrap_exception: true`.
3. `/map` was executed manually as an inline inspection, not as the V2 command (which did not exist).
4. The four ADRs describing V2 are themselves not V2-governed artifacts.
5. **Commits are task-level, not per-node.** The node loop requires one atomic commit per `VERIFIED`
   node; P1's nodes were authored in a single pass before the contract defining that rule was
   committed. From P2 onward, per-node commits apply.

Nodes N5 onward are genuinely governed by V2 in the sense that the contract defining V2 was already
written when they were built — but the honest summary is the graph-level flag: **do not read
`P1.json` as self-governing.**

## Open decisions

None outstanding. Five were resolved by the human before implementation (2026-08-02): freeze `src/`
as Legacy v0 rather than delete it · use task id `P1` · add the blocking pre-commit test gate ·
native sub-agents for audit fan-out with Herdr panes reserved for `/consensus-review` · encode the
PostgreSQL 19-beta / 18-production posture as ADR 0004.

Decisions deliberately carried to Phase 1 are recorded in `98-nice-to-haves.md`; the one with a hard
gate attached is the lexical-ranking implementation, which must be benchmarked and ADR'd **before**
retrieval production code begins.
