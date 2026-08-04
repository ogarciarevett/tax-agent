# Pipeline V2 — graph-orchestrated loop engineering

> The lifecycle. Project-specific contract lives in `.ai/context.md`.
> `sh scripts/sync-ai-docs.sh` assembles both into the generated entry files.
> Schemas: `.ai/references/task-graph-schema.md`, `.ai/references/evidence-graph.md`,
> `.ai/references/loop-state-machines.md`.

The pipeline runs once PER TASK. A task is decomposed into a **DAG of nodes**; each node runs its
own closed loop and is verified independently. Work is directed by node readiness, not by a linear
step counter.

## Stages

### 0. IDENTIFY
Fix the task id and its spec source (`.ai/context.md` → "Task identity & spec source"). State which
backlog source was detected **and how**. Establish task ownership. Classify whether the task is
**financially material** and whether it **changes the operating contract itself** — both change
which reviewers are mandatory at stage 8.

### 1. MAP — `/map`
Inspect repository reality. Identify impacted modules, docs, schemas, tests, skills, commands, and
generated artifacts; existing invariants; affected loops; affected domain-graph concepts. Calculate
blast radius. Produce a current-state map. **Performs no writes** — its findings land in the spec's
*Blast radius* section at stage 2.

### 2. SPEC — `/spec`
Define the behavioral contract: acceptance criteria, scope and non-goals, invariants, tenancy and
security boundaries, data classification, the intended **graph delta**, affected loops, uncertainty
and open decisions. **Obtain human approval before stage 3.**

### 3. GRAPH PLAN — `/plan`
Compile the approved spec into `.ai/specs/task-graphs/<id>.json`: nodes, dependencies, critical
path, node-level read/write sets, safe-parallel candidates, risks, verification commands, global
gates. Reject cycles. Link every node to ≥1 acceptance criterion or invariant.
**Obtain human approval before any implementation.**

### 4. HUMAN APPROVAL
The gate between planning and building. A behavior-changing amendment to spec or graph returns here.

### 5. SELECT READY NODE
Choose only a `READY` node. Prefer critical-path and high-risk proof nodes. Never select a node with
unverified dependencies. Never select two parallel writer nodes with overlapping write sets.

### 6. NODE LOOP
For ONE node: `RED/PROVE → BUILD → GREEN → REVIEW → RECONCILE → VERIFY (or loop back)`.

1. Read the approved node contract.
2. Write or identify a failing test where the behavior is testable. **Prove the failure — paste it.**
3. Implement the minimum change, touching only files in the node's `write_set`.
4. Prove local tests green — paste it.
5. Run the node's declared invariant tests.
6. Run the required type/lint/build checks.
7. `/review` — correctness, architecture, security, performance, graph consistency, loop correctness.
8. `/reconcile` — planned vs actual graph impact.
9. Attach evidence. Mark `VERIFIED` only when every gate passes.
10. **Commit only after the node is `VERIFIED`** — one atomic commit per verified node, citing the
    task and node id.

### 7. SUBGRAPH INTEGRATION — `/test`
After all nodes in a slice are verified: integrate node outputs, then run cross-node tests, property
tests, migration and persistence checks, authorization isolation checks, graph consistency checks,
and loop transition checks. Check for new undocumented edges, orphan nodes, and stale assumptions.

### 7b. FEATURE EVALS — `/eval`
Run the `EVALS.md` catalogue. Every feature is proved across **four surfaces**: UI, backend log,
DB rows, and returned output. `/test` proves the code works; `/eval` proves the feature is visible
where a user and an operator look. Every eval **accounts for** all four surfaces — `assert`,
`n/a: <reason>`, `blocked: <reason>`, or `not-implemented`. A silently omitted surface is a hard
failure; a fabricated assertion for a surface the feature does not have is worse. Writes
`.ai/specs/95-eval-results.md`.

### 8. CONSENSUS REVIEW — `/consensus-review`
**The only reviewer fan-out stage.** Mandatory reviewer sets and the approval rule are defined in
`.ai/context.md` → "Consensus review". Not a generic 2-of-3: every mandatory correctness reviewer
must approve, and majority voting cannot override a correctness proof failure. Structure the panel
and synthesis with the `six-thinking-hats` skill. Writes `.ai/specs/03-review.md`.

### 9. CODE SIMPLIFICATION — `/code-simplify`
Apply approved reviewer findings. **Preserve invariants, graph edges, and evidence paths.** Rerun
affected gates. Never simplify away provenance or auditability.

### 10. SHIP PREPARATION — `/ship`
Mechanical only. Local atomic commits; no push, no PR, no remote branch, no deployment. Print clean
status and `git log`; produce a ready-to-paste PR body including task-graph and acceptance
references. **`/ship` does not run the reviewer fan-out** — that is stage 8.

### 11. ACCEPTANCE GRAPH — `/acceptance`
Build the evidence graph: `requirement → behavior → implementation → test → passing output`.
Also cover invariants, graph delta, loop transitions, security boundary, tenancy boundary,
documentation, and generated-contract synchronization. Writes `.ai/specs/99-acceptance.md`.

### 12. GOAL CLOSURE — `/goal`
Continue only on incomplete graph nodes or broken evidence paths. Do NOT claim project completion
because code compiles. Completion is local commits + green acceptance, never a push.

### 13. EVOLVE — `/evolve`
Compare repository reality against `.ai/context.md`, `.ai/pipeline.md`, project specs, task graphs,
financial-domain-graph schema, loop state-machine specs, actual implementations, tests, and exposed
interfaces. `/evolve` **proposes** patches to `.ai/specs/97-evolution.md`; it must never silently
rewrite the contract.

## Node state machine

`PROPOSED → READY → IMPLEMENTING → TESTED → REVIEWED → RECONCILED → VERIFIED`

Exceptional states: `BLOCKED` · `TEST_FAILED` · `REVIEW_FAILED` · `GRAPH_DRIFT` ·
`INVARIANT_FAILED` · `SUPERSEDED`.

| From | To | Gate | Who | Evidence required |
|---|---|---|---|---|
| — | PROPOSED | `/plan` compiles the node from an approved spec | lead | node in `<id>.json`, links ≥1 criterion or invariant |
| PROPOSED | READY | readiness rule below holds | validator + lead | `validate-task-graph.mjs --ready` output |
| PROPOSED | BLOCKED | unresolved dependency, missing input, or open question | lead | blocker text in the node |
| BLOCKED | PROPOSED | blocker resolved | lead | what changed |
| READY | IMPLEMENTING | `/build` selects the node | lead | RED test written **and its failure pasted** |
| IMPLEMENTING | TESTED | node tests green + typecheck + lint | lead | pasted GREEN run + `tsc` + `biome` output |
| IMPLEMENTING | TEST_FAILED | node tests fail after implementation | lead | pasted failure |
| TEST_FAILED | IMPLEMENTING | fix attempt | lead | — |
| IMPLEMENTING / TESTED | INVARIANT_FAILED | a declared invariant test fails | lead | pasted failure |
| INVARIANT_FAILED | IMPLEMENTING | remediation | lead | — |
| IMPLEMENTING | BLOCKED | 3+ failed cycles, or a newly discovered blocker | lead | what is blocking; the node returns to `/spec` |
| TESTED | REVIEWED | `/review`, no blocking finding | lead / reviewer | review report |
| TESTED | REVIEW_FAILED | blocking finding raised | reviewer | finding text |
| REVIEW_FAILED | IMPLEMENTING | remediation | lead | — |
| REVIEWED | RECONCILED | actual diff ⊆ declared `write_set`; graph delta matches | validator + lead | `--reconcile --node <id>` output |
| REVIEWED | GRAPH_DRIFT | writes outside `write_set`, or spec/graph disagree | validator | diff listing |
| GRAPH_DRIFT | PROPOSED | spec/graph amended; **re-approved by the human if behavior changed** | human | approval note |
| RECONCILED | VERIFIED | verification rule below holds | lead | full evidence block + node commit |
| VERIFIED | REVIEW_FAILED | `/acceptance` finds the recorded evidence no longer holds | lead | the failing re-run |
| any | SUPERSEDED | the spec replaced this node | human | replacing node id |

**Failure states are written, not skipped.** On a failure, `/build` and `/review` write the failure
state into the node **first**, then transition back to `IMPLEMENTING`. Going straight back erases
the fact that the node ever failed, which is how a flaky node looks clean in the acceptance report.

**Invalid transitions fail explicitly.** Skipping a state is a contract violation, not a shortcut.
A failed node returns to `IMPLEMENTING` — never forward.

### Readiness rule
**This is the single normative statement of the rule; every other file cites it rather than
restating it.** A node is `READY` only when:

| # | Clause | Enforced by |
|---|---|---|
| 1 | every dependency is `VERIFIED` | `validate-task-graph.mjs --ready` |
| 2 | every declared `input` exists on disk | `validate-task-graph.mjs --ready` |
| 3 | no in-flight (`IMPLEMENTING`) node holds a conflicting write set | `validate-task-graph.mjs --ready` |
| 4 | its spec is human-approved | **not enforced** — human gate, printed as a disclaimer by `--ready` |

There is no separate "no unresolved blocker" clause: a blocked node carries `status: BLOCKED`, which
is not a selectable state, so clause 4 of the older wording was redundant *and* unimplementable
(the schema has no `blocker` field). Selectable states are `PROPOSED` and `READY`.

### Verification rule
A node is `VERIFIED` only when: implementation exists · its relevant tests pass · required invariant
tests pass · review has no blocking finding · actual graph impact matches the approved graph delta ·
acceptance criteria have pasted evidence · no unexplained scope exists · its Honest Implementation
Report row is evidence-backed.

### Retry, resume, idempotency, compensation
- **Retry** is bounded to the failing node; it re-enters `IMPLEMENTING`. Siblings are untouched.
- **Resume**: the node `status` in the committed `<id>.json` is the resume point. A new session
  reads the graph, recomputes readiness, and continues. No hidden session state.
- **Idempotent and safe to re-run**: `/map`, `/reconcile`, `validate-task-graph.mjs`,
  `sh scripts/sync-ai-docs.sh`. **`/build` is not idempotent** — it is guarded by node state instead.
- **Compensation**: a node with `side_effects` must declare a `compensation` step. Nodes with no
  side effects declare `[]`.

## Command ownership (no overlaps)

| Command | Owns | Does NOT own |
|---|---|---|
| `/map` | blast radius, current-state map. No writes. | requirements; it is descriptive, never normative |
| `/spec` | the behavioral contract + acceptance criteria + intended graph delta | node decomposition; implementation |
| `/plan` | compiling the task DAG | writing code; approving its own graph |
| `/build` | ONE node: RED evidence, minimum implementation, GREEN evidence, node gates, node commit | cross-node/integration testing; reviewer fan-out; selecting >1 node |
| `/test` | subgraph integration, property/invariant/migration/authz suites, coverage gate | per-node RED/GREEN; feature-level four-surface proof (`/eval`) |
| `/eval` | the `EVALS.md` catalogue: UI + log + DB + output per feature | unit-level assertions (that is `/test`) |
| `/review` | one node or subgraph, six axes | multi-persona fan-out; committing |
| `/reconcile` | planned vs actual graph impact; unexplained scope | changing the spec; approving drift |
| `/consensus-review` | **all reviewer fan-out** + synthesis + verdict | committing; simplifying code |
| `/code-simplify` | applying approved findings | removing provenance, invariants, edges, evidence |
| `/ship` | mechanical close: status, log, PR body | reviewer fan-out; pushing; PRs; deploys |
| `/acceptance` | the evidence graph | marking ✅ without pasted output |
| `/goal` | closure loop over incomplete nodes | declaring done because it compiles |
| `/evolve` | proposing drift patches | applying anything silently |

## Parallel work

**Default: ONE writer.** Contract and bootstrap work is always single-writer.

Parallel implementation nodes are permitted ONLY when all hold:
- no dependency path exists between them;
- write sets are disjoint;
- schema ownership does not overlap;
- shared invariants are not being modified concurrently;
- each writer uses a **separate git worktree**;
- the lead integrates and reruns all global gates.

`parallel_safe` is **derived by the validator**, never authored by hand — an authored copy is a
second source of truth that will eventually authorize two writers onto the same file.

**Read-only fan-out is always safe** and is the default for review and analysis: native sub-agents
(Claude Code `Agent`, or the tool's equivalent in Codex / Gemini / opencode). Brief each with FRESH,
verified context — the relevant spec section, the actual files to read, confirmed APIs, not guesses.
Reviewers do not invoke other reviewers; there is **no nested orchestration**.

An external terminal multiplexer (e.g. Herdr) may host these roles in separate panes for visibility
and model diversity. It is an **execution and observability surface only** — never the workflow
source of truth, the task-graph database, or the evidence store, and never permission for two agents
to write the same file. Pane/agent status (`idle`, `done`, `unknown`) is visibility, **not proof**.
See `docs/adr/0003-herdr-orchestration-boundary.md`.
