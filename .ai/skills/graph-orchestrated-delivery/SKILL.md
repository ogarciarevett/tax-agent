---
name: graph-orchestrated-delivery
description: Compile an approved task spec into a validated dependency DAG, then deliver it node by node with readiness-directed selection, write-set discipline, and per-node evidence. Use when planning or executing any task under Pipeline V2, when deciding what to work on next, when work must survive a context loss, or when you need to know whether two pieces of work can run in parallel.
---

# Graph-Orchestrated Delivery

Work is directed by a **dependency graph**, not a linear step counter. Each node is an
independently verifiable unit with its own read/write sets, invariants, verification commands, and
evidence. The graph is committed, so progress survives a lost context, a crashed tool, or a
different agent picking the work up tomorrow.

**The thesis:** a plan you cannot validate is a plan you cannot trust. Prose plans drift silently;
a compiled graph fails loudly.

## When to Use

- Planning any task under Pipeline V2 (`/plan`)
- Choosing what to work on next (`/build` node selection)
- Deciding whether two pieces of work can safely run in parallel
- Resuming a task in a fresh session
- Reconciling what was planned against what actually changed (`/reconcile`)

**When NOT to use:** a single-file edit, a typo fix, or a doc tweak. Compiling a one-node graph to
change one line is ceremony with no payer — just make the change.

## Non-goals

- **Not a workflow engine.** It stores no runtime state, schedules nothing, executes nothing.
- **Not a replacement for the spec.** The spec is normative; the graph is compiled from it.
- **Not the financial domain graph.** That is graph 3, lives in PostgreSQL, and is a product concern.
- **Not a project-management tool.** It models one task, not a roadmap.

## Required inputs

| Input | Why |
|---|---|
| A **human-approved** spec (`.ai/specs/<id>-spec.md` or an external ticket) | the graph is compiled from it and may never override it |
| The blast radius from `/map` | write sets are guesses without it |
| `.ai/references/task-graph-schema.md` | the schema is normative |
| A working `node scripts/validate-task-graph.mjs` | an unvalidated graph proves nothing |

If the spec is not approved, stop. Compiling a graph from a draft spec produces work nobody agreed to.

## Terminology

- **Node** — one independently verifiable unit of change.
- **Read set / write set** — globs a node may read / may write. The write set is a **contract**,
  not a hint.
- **Readiness** — defined once in `.ai/pipeline.md` → "Readiness rule"; computed by
  `validate-task-graph.mjs --ready`. Never restate it — run it.
- **Critical path** — the longest dependency chain; where delay costs the most.
- **Graph delta** — the nodes and edges a task intends to add, modify, or remove.
- **Unexplained scope** — a changed file in no node's write set.
- **Bootstrap exception** — a node whose work was governed by a previous contract, marked honestly.

## Procedure

### 1. Decompose vertically
Slice by complete path, not by layer. "Add the column, then the query, then the UI" is three
horizontal slices that cannot be verified independently; "make X work end to end" is one node that
can. A node that cannot be verified alone is either two nodes or none.

### 2. Declare dependencies honestly
Only real dependencies. A false edge serializes work for nothing; a missing edge lets you build on
sand. Ask of each edge: *would this node actually fail if that one hadn't happened?*

### 3. Declare read and write sets
Be precise. `src/**` as a write set is a refusal to think, and it makes `/reconcile` useless — a
write set that matches everything can never catch unexplained scope.

### 4. Attach criteria, invariants, and commands
Every node links to at least one acceptance criterion or invariant, and carries at least one
literal runnable verification command. Leave `parallel_safe: null` — always.

### 5. Validate, and paste the output
```sh
node scripts/validate-task-graph.mjs .ai/specs/task-graphs/<id>.json
node scripts/validate-task-graph.mjs --ready .ai/specs/task-graphs/<id>.json
```
Fix the graph, never the validator.

### 6. Get graph approval, then deliver node by node
Select a `READY` node, prefer the critical path, run the node loop, reconcile, verify, commit.
Repeat.

## State transitions

This skill drives `PROPOSED → READY` (selection) and `REVIEWED → RECONCILED | GRAPH_DRIFT`
(reconciliation). The full table lives in `.ai/pipeline.md` -> "Node state machine"; `.ai/references/loop-state-machines.md` explains it. Two rules matter
most here:

- A node may not be selected unless it is selectable (`PROPOSED` or `READY`) and the readiness rule holds. "It's probably fine" is how two writers end up
  in the same file.
- `GRAPH_DRIFT` returns to `PROPOSED`, not `IMPLEMENTING` — drift means the **plan** was wrong.

## Graph impact

Every task modifies graph 2 (task execution) and, on completion, contributes to graph 4 (evidence).
A task that touches the repository's structure also invalidates cached graph 1 (repository reality)
— re-run `/map` rather than trusting a stale scan. Graph 3 is untouched by this skill.

## Invariants

1. **The graph never overrides its spec.** Precedence: ticket → task spec → project spec → graph →
   status.
2. **The DAG is acyclic.** Enforced by the validator; a cycle is a hard failure, never a warning.
3. **Every node is explained** by at least one acceptance criterion or invariant.
4. **Every node is checkable** — at least one literal verification command.
5. **`parallel_safe` is derived, never authored.**
6. **No `VERIFIED` node has empty evidence.**
7. **Actual writes stay inside the declared write set.**
8. **`compensation` is non-empty exactly when `side_effects` is.**

## Mandatory tests

- `node scripts/validate-task-graph.test.mjs` — proves the validator still detects cycles,
  evidence-free `VERIFIED` nodes, and write-set overlap.
- `node scripts/validate-task-graph.mjs <graph>` — on every committed graph.
- `node scripts/validate-task-graph.mjs --reconcile <graph>` — before any node reaches `VERIFIED`.

## Evidence requirements

Per node: the RED failure pasted, the GREEN pass pasted, invariant-test output, gate output, and an
`evidence[]` entry per acceptance criterion recording the command and its actual output. A node
whose evidence is "implemented as described" is not verified — it is asserted.

## Failure modes

| Failure mode | What it looks like | Why it happens |
|---|---|---|
| **Graph theater** | a beautifully structured graph nobody validates | the validator was never run, or its output was not pasted |
| **Wildcard write sets** | `write_set: ["**"]` | avoids the work of thinking about blast radius; disables drift detection |
| **False edges** | everything depends on everything | uncertainty expressed as dependency; kills parallelism |
| **Node inflation** | 40 nodes for a 3-file change | verification overhead exceeds the work |
| **Silent scope creep** | "while I was in there…" | the file was not in any write set and nobody ran `/reconcile` |
| **Retro-fitting the spec** | spec edited to match a graph already written | precedence inverted; the spec stops being normative |
| **Authored `parallel_safe`** | `parallel_safe: true` in source | a second source of truth that will eventually authorize two writers onto one file |

## Recovery

- **Cycle detected** → find the false edge. One of those dependencies is aspiration, not necessity.
- **Unexplained scope** → either revert the stray change, or amend the graph and re-approve. Never
  widen the write set after the fact to make the check pass — that is falsifying the evidence.
- **Spec/graph disagreement** → mark the node `GRAPH_DRIFT`. Reconcile in favour of the spec. If behavior
  changed, a human re-approves.
- **Node failing repeatedly (3+ cycles)** → the node is mis-specified. Stop retrying, mark
  `BLOCKED`, return to `/spec`.
- **Lost context mid-task** → read the committed graph, run `--ready`, continue. That is the whole
  point of committing it.

## Output format

```markdown
## Task graph — <task-id>

**Spec source:** <path or ticket id>   **Nodes:** N   **Bootstrap exception:** yes/no

| Node | Title | Depends on | Write set | Risk | Status |
|------|-------|-----------|-----------|------|--------|

**Critical path:** N1 -> N4 -> N9
**Global gates:** <commands>

### Validator output
```
<pasted>
```

### Open questions
- <only those genuinely needing a human>
```

## Worked example

Task `P1` must rewrite the contract, add a validator, and rewrite the README.

*Wrong decomposition (horizontal):* "N1: write all the markdown. N2: write all the code. N3: test
everything." Nothing is verifiable until the end, and N3's write set covers the whole repo.

*Right decomposition (vertical):*

- `P1.N1` — rewrite `.ai/context.md`. write_set `[".ai/context.md"]`. Verified by
  `sh scripts/sync-ai-docs.sh && git diff --stat AGENTS.md`.
- `P1.N4` — author `.ai/references/task-graph-schema.md`. depends_on `[P1.N1]` (the contract must
  name the artifact before the reference describes it). write_set `[".ai/references/*.md"]`.
- `P1.N9` — author the validator + its test. depends_on `[P1.N4]` (it implements that schema).
  write_set `["scripts/validate-task-graph*.mjs"]`. Verified by `node …test.mjs`.
- `P1.N15` — rewrite `README.md`. depends_on `[P1.N1]`. write_set `["README.md"]`.

`N9` and `N15` have disjoint write sets and no path between them, so the validator derives them as
parallel-safe — but P0 is contract work, so they still run single-writer. The derivation is
recorded; the policy overrides it. That distinction is the skill working correctly.

## Integration with pipeline commands

| Command | How this skill applies |
|---|---|
| `/map` | supplies the blast radius that makes write sets honest |
| `/plan` | compiles and validates the graph — the core of this skill |
| `/build` | readiness-directed node selection; write-set discipline |
| `/reconcile` | planned vs actual; unexplained scope |
| `/test` | subgraph integration once nodes are verified |
| `/acceptance` | node evidence rolls up into the evidence graph |
| `/goal` | continues only on incomplete nodes or broken evidence paths |

## Integration with /evolve

`/evolve` treats every `.ai/specs/task-graphs/*.json` as a drift dimension: does each `write_set`
still describe reality, are `VERIFIED` nodes still backed by passing tests, does the schema version
still match `.ai/references/task-graph-schema.md`? It runs the validator over all graphs and pastes
the result. Findings are **proposed** in `.ai/specs/97-evolution.md`, never applied silently.
