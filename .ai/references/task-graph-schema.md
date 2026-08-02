# Task Execution Graph — schema v1.0

The **task execution graph** is graph 2 of the four described in `.ai/context.md`. It represents ONE
task as a dependency DAG so the pipeline can determine readiness, critical path, and safe
parallelism, and so every implementation node carries its own invariants and evidence.

- **Artifact:** `.ai/specs/task-graphs/<task-id>.json` (committed)
- **Normative spec:** `.ai/specs/<task-id>-spec.md`, or the external ticket
- **Backlog index:** `.ai/specs/02-plan.md`
- **Validator:** `node scripts/validate-task-graph.mjs .ai/specs/task-graphs/<task-id>.json`

## The precedence rule (read this first)

1. Human-approved external ticket, when the repository uses an external backlog
2. `.ai/specs/<task-id>-spec.md`
3. Project architecture in `.ai/specs/01-spec.md`
4. The compiled task graph
5. Execution status and reports

**The compiled task graph may never override its normative spec.** If the graph and the spec
disagree: **stop**, mark the node `GRAPH_DRIFT`, reconcile the difference, and obtain human approval
when behavior changes. This is a hard stop, not a warning.

## Schema

```jsonc
{
  "schema_version": "1.0",
  "task_id": "P1",
  "spec_source": ".ai/specs/P1-spec.md",   // must exist on disk (or be an external ticket URL/id)
  "goal": "One sentence.",
  "bootstrap_exception": false,             // see "Bootstrap exceptions" below
  "graph_delta": {
    "nodes_added": [], "nodes_modified": [], "nodes_removed": [],
    "edges_added": [], "edges_removed": []
  },
  "nodes": [
    {
      "id": "P1.N1",                        // unique within the file, "<task-id>.N<n>"
      "title": "Imperative, one line.",
      "kind": "contract|command|skill|persona|reference|spec|adr|doc|script|test|schema|migration|ui|api",
      "status": "PROPOSED",                 // see .ai/references/loop-state-machines.md
      "depends_on": [],                     // node ids in THIS file
      "read_set": [],                        // globs this node may read
      "write_set": [],                       // globs this node may write — the ONLY files it may change
      "inputs": [],                          // artifacts that must exist before READY
      "outputs": [],                         // artifacts this node produces
      "invariants": [],                      // properties that must hold after this node
      "acceptance_criteria": [],             // ≥1 required, unless the node declares ≥1 invariant
      "verification_commands": [],           // ≥1 required, literal and runnable
      "risk": "low|medium|high|critical",
      "financially_material": false,
      "side_effects": [],                    // migrations, external writes, anything not undone by git
      "compensation": [],                    // required non-empty iff side_effects is non-empty
      "parallel_safe": null,                 // DERIVED — never authored, always null in source
      "evidence": [                          // required non-empty before status VERIFIED
        // { "criterion": "AC1", "command": "pnpm test", "output_excerpt": "…", "file_ref": "src/x.ts:42" }
      ]
    }
  ],
  "critical_path": ["P1.N1"],
  "global_gates": [],                        // commands that must pass for the whole task
  "open_questions": []
}
```

### Field notes

**`bootstrap_exception`** — graph-level. `true` marks a task whose work was governed by a *previous*
contract rather than by this pipeline. Without this field a post-hoc graph is indistinguishable from
one that genuinely governed its own creation, which is exactly the false claim the honesty protocol
forbids. Set it honestly; it is cheaper than a lie. When only *some* of the work was pre-pipeline,
set the flag `true` and enumerate precisely which parts in the task spec — the flag says "do not
read this graph as self-governing", and the spec says why.

**`parallel_safe` is derived, never authored.** It is fully determined by write-set overlap and
reachability (algorithm below). An authored copy is a second source of truth that will drift and
will eventually authorize two writers onto the same file. Authors leave it `null`; the validator
computes it.

**`write_set` is a contract, not a hint.** `/reconcile` compares the actual diff against the union
of write sets. A changed file that appears in no node's write set is **unexplained scope** and
blocks verification.

**`acceptance_criteria` vs `invariants`.** Every node must link to at least one of them. A node that
links to neither is unexplained work — it exists without a reason traceable to the spec.

An `acceptance_criteria` entry cites a **numbered criterion that exists in `spec_source`** (`"AC7 …"`).
If the evidence proves a node invariant rather than a spec criterion, tag it
`"invariant: <the invariant>"` instead of borrowing an unrelated AC number — a mis-tagged criterion
breaks the requirement→evidence link while still looking complete. **The validator cannot catch
this**; it does not resolve criterion ids across files. It is a mandatory reviewer check.

**`graph_delta.edges_added` shorthand.** Edges may be written `"N1->N2"` (the `<task-id>.` prefix is
implied) and `"*->N16"` where `*` means *every other node in this file*. The shorthand is a summary
for humans; `depends_on` remains authoritative, and any expansion must equal the `depends_on` edge
set exactly.

## Algorithms

### Cycle detection
`depends_on` induces a strict DAG. Detect cycles with a DFS three-colour walk (white/grey/black);
any edge to a grey node is a back edge and a hard error. Self-dependency is a cycle. Every
`depends_on` entry must resolve to a node id in the same file.

### Readiness

**Normative statement: `.ai/pipeline.md` → "Readiness rule".** Deliberately not restated here —
three divergent copies of this rule existed at one point, with different clause counts. Implemented
by `readyNodes()` in `scripts/validate-task-graph.mjs`; run `--ready` rather than reasoning about it.

Selectable states are `PROPOSED` and `READY`. Anything else — including `BLOCKED` — is not
selectable, which is why there is no separate "blocker" clause and no `blocker` field.

### Parallel safety

```
PARALLEL_SAFE(a,b) ⟺ write_set(a) ∩ write_set(b) == ∅
                   ∧ ¬reachable(a,b) ∧ ¬reachable(b,a)
                   ∧ write_set(a) ∩ read_set(b) == ∅
                   ∧ write_set(b) ∩ read_set(a) == ∅
                   ∧ a.invariants ∩ b.invariants == ∅
```

Two parallel-safe nodes may only be built concurrently in **separate git worktrees**, with the lead
integrating and rerunning all global gates afterwards. Contract and bootstrap work is always
single-writer regardless of what this computes.

### Critical path
The longest dependency chain by node count (ties broken by total `risk`, `critical` > `high` >
`medium` > `low`). Prefer critical-path and high-risk proof nodes when selecting the next `READY`
node.

## What the validator checks

Run `node scripts/validate-task-graph.mjs <file>`; non-zero exit on any violation.

| Mode | Checks |
|---|---|
| *(default)* | `schema_version` present · `spec_source` exists on disk · node ids unique and well-formed · every `depends_on` resolves · **no cycles** · every node links ≥1 acceptance criterion or invariant · every node has ≥1 verification command · `compensation` non-empty iff `side_effects` non-empty · no `VERIFIED` node with empty `evidence` · `parallel_safe` is `null` in source · `critical_path` entries resolve |
| `--ready` | prints the `READY` set per the readiness rule, plus the computed critical path |
| `--reconcile` | compares changed files against the union of `write_set`s; reports files changed outside any write set (unexplained scope) and declared writes never touched |

## Deliberate non-goals

- **This is not a workflow engine.** It stores no runtime state, schedules nothing, and executes no
  nodes. Humans and slash commands execute; the JSON records intent and outcome.
- **It does not replace the spec.** See the precedence rule.
- **It is not the financial domain graph.** That is graph 3, lives in PostgreSQL, and is not
  implemented in P0.
