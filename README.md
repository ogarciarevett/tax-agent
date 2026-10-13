<div align="center">

<img src="assets/tax-agent.svg" width="180" alt="tax-agent: a receipt with a check mark">

# tax-agent

**Local bill tracking and source-backed tax estimates for Spain.**

[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6)](https://www.typescriptlang.org/) [![Node.js 22+](https://img.shields.io/badge/runtime-Node.js_22%2B-43853D)](https://nodejs.org/) [![SQLite](https://img.shields.io/badge/storage-SQLite-4DB6AC)](https://www.sqlite.org/)

Works with **Node.js** · **SQLite** · **Gmail**

</div>

---

## ⚠️ Current status — read this first

**The platform described below is NOT implemented.** No PostgreSQL schema, no Next.js app, no
ledger, no domain graph, no UI. This repository is in its **pipeline / bootstrap phase**: the work
completed so far is the *operating contract* and the *delivery pipeline* that will govern building
the platform.

What **does** exist and run today is the **Legacy CLI (v0)** — a shipped, tested, single-user,
Spain-only local-first tax CLI on an entirely different stack. It is **frozen** and **not deleted**.
See [Legacy CLI (v0)](#-legacy-cli-v0--shipped-frozen).

This ordering is deliberate. The product's dominant failure mode is a confident wrong number, so the
machinery that will build it is specified, reviewed and validated *before* it is trusted with money.

## 💡 Product thesis

A household's finances are spread across accounts, institutions, debts, assets, obligations, goals
and jurisdictions. The information needed to reason about them already exists — in statements,
invoices and rules — but nothing connects it, and nothing can explain a conclusion afterwards.

Tax Agent assembles that position from **append-only financial facts**, explains it with a
**financial domain graph**, evidences it with **ingested documents**, and surfaces **auditable
recommendations that a human approves before anything happens**.

It is built to be reusable and multi-tenant from day one: arbitrary users, households, household
members, accounts, institutions, liabilities, assets, jurisdictions, currencies, goals, tax
calendars, risk tolerances and recurring obligations. The initial owner's real financial data may
later appear as private seed data — **it must never become universal business logic**.

## 🔒 Core correctness principles

The fourteen non-negotiables ([`.ai/context.md`](.ai/context.md)):

1. No loss or silent mutation of financial facts
2. Deterministic monetary calculations
3. **No floating-point money arithmetic**
4. Explicit currency on every monetary value
5. Household and tenant isolation
6. Provenance for every imported fact
7. **No LLM-only financial arithmetic**
8. **No LLM-initiated transfer, trade or debt payment**
9. Explicit separation between actual, planned, forecast, simulated and recommended
10. Immutable scenario inputs
11. Reproducible recommendations
12. Evidence and assumptions attached to every financially material recommendation
13. No stablecoin represented as equivalent to a protected bank deposit
14. No tax estimate represented as professional tax advice

Two of these already have a working precedent in the legacy tree: money is integer cents throughout,
and `TraceableFigure` **throws** if constructed without sources — "no number without a source" is a
runtime invariant, not a review checklist item.

## 🕸️ Four graphs — never conflated

The structural core ([ADR 0002](docs/adr/0002-graph-source-of-truth-separation.md)). Authority is
the column that matters:

| # | Graph | Purpose | Authority | Lives in |
|---|-------|---------|-----------|----------|
| 1 | **Repository reality** | files, modules, imports, tests, commands — blast radius | **descriptive only**, never normative | ephemeral, gitignored |
| 2 | **Task execution** | one task as a dependency DAG — readiness, critical path, safe parallelism | normative for order; **subordinate to its spec** | `.ai/specs/task-graphs/*.json` |
| 3 | **Financial domain** | relationships, blockers, enablers, exposure, provenance, explanations | normative for *why* | PostgreSQL *(Phase 1)* |
| 4 | **Evidence** | requirement → behavior → implementation → test → passing output | normative for **"is it done"** | task reports + `99-acceptance.md` |

Two rules do the heavy lifting:

- **The ledger is the source of financial truth.** The domain graph *explains* it and never replaces
  it. No authoritative balance is stored in graph 3.
- **RAG is never authoritative for current balances.** It supplies documentary evidence and
  historical context. A balance answered from a retrieved PDF is as old as the PDF.

## 🔁 Graph + loop + hardness

Three ideas the pipeline is built from — each has a skill under [`.ai/skills/`](.ai/skills/):

- **Graph** — work is a validated DAG, not a checklist. Nodes carry read/write sets, invariants,
  verification commands and evidence. Progress lives in a committed file, so it survives a lost
  context or a different agent picking it up tomorrow. → `graph-orchestrated-delivery`
- **Loop** — a financial loop is closed only when the **outcome** feeds back into the next plan.
  Judged on its failure paths, not its happy path: retry, resume, idempotency, compensation, and a
  human approval gate before any financially material effect. → `financial-loop-engineering`,
  `financial-graph-engineering`
- **Hardness** — the system must be unable to claim what it has not proven. Every hard gate must
  have been *observed failing*; evidence is files, diffs and pasted output — never a reviewer's
  opinion, never an agent's `done` status. → `financial-hardness-engineering`

> A gate that cannot fail is not a gate. This repository carried "coverage ≥ 80%" in its Definition
> of Done while the only test run was `post-commit`, whose script swallowed failures and exited 0 —
> with no CI. Nothing could ever fail on tests. That is the class of defect hardness engineering
> exists to find.

## 🧱 Locked stack

TypeScript 7 · Bun · Next.js App Router · React Server Components by default · PostgreSQL ·
pgvector · PostgreSQL lexical retrieval · hybrid lexical + vector retrieval with reciprocal-rank
fusion · Drizzle ORM · Zod · shadcn/ui · Tailwind CSS · OpenTelemetry · structured logging ·
Vitest · Playwright · Docker Compose · committed SQL migrations.

### PostgreSQL version posture

[ADR 0004](docs/adr/0004-postgresql-19-version-posture.md). **PostgreSQL 19 is the development and
compatibility target; production posture remains the latest supported PostgreSQL 18** until 19
reaches general availability and passes compatibility validation here.

As of 2026-08-02, **PostgreSQL 19 is in Beta 2** (released 2026-07-16) and is **not** generally
available. This contract does not describe a beta as production-ready. Migrations and core queries
are evaluated against both versions during the transition; the decision is revisited via `/evolve`
and a human-reviewed ADR update at GA.

### Retrieval honesty

pgvector is the vector store — no separate vector database, no Elasticsearch or OpenSearch without
an ADR and evidence. And PostgreSQL's `ts_rank` **must not be called BM25 unless it is BM25**: the
concrete lexical-ranking implementation must be identified, benchmarked and documented in an ADR
*before* retrieval production code begins.

### Out of bounds without an ADR

JavaScript floating-point money · a dedicated graph database in the initial phases · an external
vector database · LLM-generated SQL outside a controlled query layer · LLM mutation of financial
facts · production use of prerelease database software · hidden background financial actions ·
multi-tenant access without explicit authorization filters · hand-edited generated agent files.

## 📐 Source-of-truth model

One source, many tools. You hand-edit only `.ai/`; everything else is generated by
`scripts/sync-ai-docs.sh` (POSIX shell + awk, **zero runtime dependencies**).

```
.ai/                              ← the ONLY files you hand-edit
├── context.md                    project operating contract
├── pipeline.md                   the lifecycle (Pipeline V2)
├── commands/                     slash commands
├── agents/                       specialist personas
├── skills/                       reusable workflows
├── references/                   schemas + checklists cited by path
└── specs/                        requirements, architecture, per-task specs
    └── task-graphs/<id>.json     compiled, validated dependency DAGs

AGENTS.md · CLAUDE.md · GEMINI.md ← GENERATED, committed (never hand-edit)
.claude/ .gemini/ .opencode/ .cursor/ .ai/generated/  ← GENERATED, gitignored
```

- `AGENTS.md` **inlines** the full contract, so it is readable on GitHub and in any tool without
  `@`-import support. `CLAUDE.md` and `GEMINI.md` are thin `@AGENTS.md` stubs.
- Per-tool mirrors are **gitignored and local-only** — the repo carries no duplicated skill,
  command, or persona copies. Run the sync once per clone or your tools see zero skills.
- The pre-commit hook **regenerates and blocks** if a committed contract file drifted, and blocks if
  a generated mirror ever becomes tracked.

**To change a convention:** edit the `.ai/` source → `sh scripts/sync-ai-docs.sh` → inspect the diff
→ commit. A change that leaves generated docs stale is incomplete.

## ♻️ Lifecycle — Pipeline V2

[ADR 0001](docs/adr/0001-graph-orchestrated-loop-pipeline.md) ·
[`.ai/pipeline.md`](.ai/pipeline.md)

```
0 IDENTIFY → 1 /map → 2 /spec →[human]→ 3 /plan →[human]→ 5 select READY node
  → 6 NODE LOOP: RED → BUILD → GREEN → /review → /reconcile → VERIFY → commit
  → 7 /test → 8 /consensus-review → 9 /code-simplify → 10 /ship
  → 11 /acceptance → 12 /goal → 13 /evolve
```

Each node moves through an explicit state machine —
`PROPOSED → READY → IMPLEMENTING → TESTED → REVIEWED → RECONCILED → VERIFIED`, plus `BLOCKED`,
`TEST_FAILED`, `REVIEW_FAILED`, `GRAPH_DRIFT`, `INVARIANT_FAILED`, `SUPERSEDED`.
**No state may be skipped. Failure moves backward, never forward.**

| Command | Owns | Does NOT own |
|---------|------|--------------|
| `/map` | blast radius, current-state map (no writes) | requirements |
| `/spec` | behavioral contract, acceptance criteria, invariants, graph delta | node decomposition |
| `/plan` | compiling + validating the task DAG | writing code, approving its own graph |
| `/build` | ONE node: RED → GREEN → node gates → node commit | integration testing, reviewer fan-out |
| `/test` | subgraph integration, property/invariant/tenancy suites, coverage gate | per-node RED/GREEN |
| `/review` | one node or subgraph, six axes | multi-persona fan-out |
| `/reconcile` | planned vs actual impact; unexplained scope | changing the spec |
| `/consensus-review` | **all** reviewer fan-out + verdict | committing |
| `/code-simplify` | applying approved findings | removing provenance, invariants or evidence |
| `/ship` | mechanical close: gates, status, log, PR body | fan-out, pushing, PRs, deploys |
| `/acceptance` | the evidence graph | marking ✅ without pasted output |
| `/goal` | closure over incomplete nodes | declaring done because it compiles |
| `/evolve` | proposing drift patches | applying anything silently |

**Consensus is by mandatory reviewer, not majority.** For pipeline-contract changes the panel is
`code-reviewer` + `graph-consistency-reviewer` + `loop-correctness-reviewer` + `security-auditor`,
and **all** must approve. Majority voting cannot override a correctness proof failure.

### Task graphs are validated, not vibed

```sh
node scripts/validate-task-graph.mjs .ai/specs/task-graphs/P1.json             # cycles, unexplained nodes, evidence
node scripts/validate-task-graph.mjs --ready .ai/specs/task-graphs/P1.json     # what can be worked on now
node scripts/validate-task-graph.mjs --reconcile .ai/specs/task-graphs/P1.json # unexplained scope
pnpm test:graph                                                                # the validator's own tests
```

Zero dependencies, non-zero exit on any violation. It stores no state, schedules nothing, and
executes no nodes — it is **not** a workflow engine.

## 🖥️ Herdr — boundaries

Development may run inside [Herdr](https://herdr.dev), a terminal/agent multiplexer, to host
reviewers in separate panes for observability and cross-model diversity (e.g. a `codex` reviewer
auditing work done by Claude). [ADR 0003](docs/adr/0003-herdr-orchestration-boundary.md) fixes what
it is allowed to be:

| It IS | It is NOT |
|-------|-----------|
| an execution surface | the workflow source of truth |
| an observability surface | the task-graph database |
| a way to run independent analyses concurrently | the evidence store |
| | permission for two agents to edit the same files |

**Agent status is visibility, not proof.** `idle`, `done` and `unknown` say nothing about
correctness. **The pipeline must work without Herdr** — every stage is a slash command usable in any
supported CLI.

Read-only fan-out is always safe. Parallel **writers** require disjoint write sets, no dependency
path, non-overlapping schema ownership, and **separate git worktrees** — and contract work is always
single-writer.

## 🚀 Local setup

```sh
git clone git@github.com:ogarciarevett/tax-agent.git && cd tax-agent
sh scripts/install.sh          # regenerates the gitignored per-tool mirrors + wires git hooks
pnpm install
```

Without the sync step your tools see **zero** skills, commands, or personas — the mirrors are
local-only by design.

```sh
sh scripts/sync-ai-docs.sh     # regenerate the contract + every per-tool mirror
pnpm test                      # vitest + coverage (>= 80%, blocking pre-commit)
pnpm exec tsc --noEmit
pnpm exec biome check
pnpm test:graph                # task-graph validator self-test
```

The pre-commit hook (`git config core.hooksPath .githooks`, done by `install.sh`) runs the sync
drift gate, the mirror-tracking guard, Biome, the test suite, and typecheck. Post-commit reporting
is advisory by design; the blocking checks are pre-commit.

Per-stage model routing is available for the opencode runtime — add a `model:` key to a command or
persona's frontmatter. Keep the committed `.ai/` sources vendor-neutral; routing is an opt-in each
project sets locally (`scripts/opencode-model-routing.sh`).

## 🧊 Legacy CLI (v0) — shipped, frozen

`src/**` is a working single-user, Spain-only local-first CLI: Node 22 · pnpm · better-sqlite3 ·
opentui · local LLM CLI subprocesses. Epics A1 and B0–B7 are complete and green (~2,900 source LOC,
~2,450 test LOC).

**It is frozen — do not extend it, do not migrate it in place.** It is kept because it works, it is
tested, and it is the reference implementation for integer-cents money and rule-id provenance. Phase
6 ports its durable assets (`src/countries/es/rules.ts`, the integer-cents model, the
`figure(label, cents, ruleIds)` pattern) into the new jurisdiction plugin; the legacy tree retires
only once that port is verified.

<details>
<summary>Running the legacy CLI</summary>

`pnpm dev` runs the opentui interview once so a profile exists. `tax-agent scan` then runs one
headless pass: it asks your **local** agent CLI (`claude -p` / `codex exec`) to search Gmail for new
billing emails, verifies every amount against the email text (nothing is ever fabricated), writes one
Markdown file per bill under `~/Downloads/tax-agent/YYYY-MM/`, and records it in local SQLite. It is
idempotent — already-seen emails are skipped. Exit codes: **0** clean · **2** completed with
per-item failures · **1** fatal (re-run with `DEBUG=1`).

Config via env, all optional: `TAX_AGENT_LLM=claude|codex` (default `claude`),
`TAX_AGENT_LLM_MODEL`, `TAX_AGENT_LLM_EFFORT`, `TAX_AGENT_LLM_BIN` (absolute path to the CLI),
`TAX_AGENT_DOWNLOADS_DIR` (override the output root).

**Daily cron** (you install this once — agents never touch your crontab):

```sh
mkdir -p data/logs && chmod 700 data/logs   # cron opens this file, so it must exist first
crontab -e
```

```cron
15 8 * * * /bin/sh /absolute/path/to/tax-agent/scripts/cron-scan.sh >> /absolute/path/to/tax-agent/data/logs/cron.log 2>&1
```

`scripts/cron-scan.sh` exists because cron runs with an almost-empty environment: it pins `PATH` to
the nvm node bin that `better-sqlite3` was built against, `~/.bun/bin`, and `/opt/homebrew/bin`
before `exec`-ing the scan. Logs contain only counts, message ids, reason codes and durations —
**never** a vendor, subject, or amount.

**macOS:** TCC blocks `cron` from writing to `~/Downloads` until you grant **Full Disk Access** to
`/usr/sbin/cron` (System Settings → Privacy & Security → Full Disk Access → **+** → ⌘⇧G →
`/usr/sbin/cron`). If you'd rather not, set `TAX_AGENT_DOWNLOADS_DIR` to a path cron can write, e.g.
the repo-local `data/bills` (gitignored, `0700`).

Known limits at freeze: expense-side estimates only (no income ingestion, so no full Modelo
303/130) · extracted Markdown rather than original PDFs for some sources · no RAG · no OCR · no
filing · single user.

</details>

## 🚫 Current non-goals

- **No product implementation until the pipeline is approved.** P0 records and validates the
  contract; it builds no application code, schema, or UI.
- No autonomous financial action — the system recommends; a human acts.
- No direct filing or submission to a tax authority.
- No dedicated graph database or external vector database in the initial phases.
- No production use of prerelease database software without explicit human approval.
- **No pushing, PRs, remote branches, or deploys from an agent.** Commits are local; the human pushes.
- Not professional tax advice.

## 🗺️ Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **P0** | Pipeline V2: contract, lifecycle, task-graph schema + validator, evidence graph, loop state machines, graph/loop reviewers, four skills, ADRs, README | 🔵 self-hosting |
| **P1** | Product bootstrap: Bun + TS7 + Next.js skeleton, Docker Compose, PostgreSQL 18/19 matrix, first migration | ⬜ awaits approval |
| **P2** | Ledger — append-only financial facts, integer minor units, provenance, tenancy isolation | ⬜ |
| **P3** | Document ingestion + hybrid retrieval (pgvector + benchmarked lexical ranking, RRF) | ⬜ |
| **P4** | Financial domain graph — relationships, blockers, enablers, exposure, explanations | ⬜ |
| **P5** | Closed loops — budgets, tax reserves, debt planning, goal dependencies, mortgage readiness | ⬜ |
| **P6** | Jurisdiction plugins — port the legacy `es` rules; retire Legacy v0 | ⬜ |

Deferred work is recorded with reasons in [`.ai/specs/98-nice-to-haves.md`](.ai/specs/98-nice-to-haves.md).

## 📚 Key documents

| Document | What it is |
|----------|-----------|
| [`.ai/context.md`](.ai/context.md) | the operating contract — stack, constraints, hard rules, honesty protocol |
| [`.ai/pipeline.md`](.ai/pipeline.md) | Pipeline V2 stages, node state machine, command ownership |
| [`.ai/references/task-graph-schema.md`](.ai/references/task-graph-schema.md) | task-graph schema v1.0 + readiness/parallel-safety algorithms |
| [`.ai/references/evidence-graph.md`](.ai/references/evidence-graph.md) | what counts as evidence, and what does not |
| [`.ai/references/loop-state-machines.md`](.ai/references/loop-state-machines.md) | states, failure paths, retry, resume, compensation |
| [`.ai/references/orchestration-patterns.md`](.ai/references/orchestration-patterns.md) | endorsed patterns and anti-patterns for multi-agent work |
| [`.ai/specs/00-requirements.md`](.ai/specs/00-requirements.md) | requirements + the 14 correctness constraints |
| [`.ai/specs/01-spec.md`](.ai/specs/01-spec.md) | target architecture (+ Legacy v0 in Appendix A) |
| [`.ai/specs/02-plan.md`](.ai/specs/02-plan.md) | task backlog and index |
| [`docs/adr/`](docs/adr/) | 0001 pipeline · 0002 graph separation · 0003 Herdr boundary · 0004 PostgreSQL posture |

## 📄 Origins & license

The multi-tool contract machinery — the `.ai/` source-of-truth model, `scripts/sync-ai-docs.sh`, and
the generated per-tool mirrors for Claude Code, Cursor, Codex, Gemini CLI and opencode — originated
in **cross-ai-template**, and the skill catalogue derives from the
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) lifecycle. Pipeline V2, the
task-graph model and validator, the evidence graph, and the financial graph/loop/hardness skills are
specific to this project.

MIT — see [`.ai/AGENT-SKILLS-LICENSE`](.ai/AGENT-SKILLS-LICENSE).
