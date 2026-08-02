---
description: Compile an approved task spec into a validated dependency DAG at .ai/specs/task-graphs/<id>.json
---

# /plan — stage 3, GRAPH PLAN

Invoke the agent-skills:planning-and-task-breakdown skill, then compile the result into a machine-
readable graph. Prose plans cannot be validated; this one can.

**Precondition:** the spec is human-approved. If it is not, go back to `/spec`.

## Steps

1. **Decompose** the approved spec into nodes, slicing vertically (one complete path per node, not
   horizontal layers). One node = one independently verifiable change. A node that cannot be
   verified on its own is either two nodes or none.
2. **For each node, declare:**
   - `depends_on` — real dependencies only; a false edge serializes work for no reason.
   - `read_set` / `write_set` — globs. The `write_set` is a **contract**: `/reconcile` will fail the
     node if it writes outside it.
   - `acceptance_criteria` and/or `invariants` — at least one. A node linked to neither is
     unexplained scope and the validator rejects it.
   - `verification_commands` — literal and runnable. "run the tests" is not a command.
   - `risk`, `financially_material`, `side_effects` (+ `compensation` if non-empty).
   - `parallel_safe: null` — **always**. It is derived by the validator, never authored.
3. **Record the `graph_delta`** — the nodes and edges this task adds, modifies, or removes.
4. **Set `bootstrap_exception`** honestly: `true` only for nodes whose work was governed by a
   previous contract rather than by this pipeline.
5. **Write** `.ai/specs/task-graphs/<id>.json` per `.ai/references/task-graph-schema.md`.
6. **Validate — and paste the output:**
   `node scripts/validate-task-graph.mjs .ai/specs/task-graphs/<id>.json`
   `node scripts/validate-task-graph.mjs --ready .ai/specs/task-graphs/<id>.json`
   Cycles, unresolved dependencies, unexplained nodes, and missing verification commands are hard
   failures. Fix the graph, not the validator.
7. **Update** the `.ai/specs/02-plan.md` index row for this task.
8. **Present the graph for human review and STOP.** Implementation may not begin before graph
   approval.

## Rules

- The graph serves the spec. If they disagree, the spec wins — mark the node `GRAPH_DRIFT` and
  reconcile. Never quietly edit the spec to match a graph you already wrote.
- Do not declare two independent nodes parallel-safe by writing it down; declare disjoint write
  sets and let the validator conclude it.
- Prefer fewer, larger nodes over many trivial ones. Every node carries verification overhead.
