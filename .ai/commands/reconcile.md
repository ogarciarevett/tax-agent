---
description: Reconcile planned versus actual graph impact for a node or task — detect unexplained scope and mark RECONCILED or GRAPH_DRIFT
---

# /reconcile — the drift gate

Compare what the approved task graph said would change against what actually changed. This is the
transition `REVIEWED → RECONCILED` (or `→ GRAPH_DRIFT`). It is the mechanical defence against
scope that nobody asked for.

## Steps

1. **Run the validator.**
   `node scripts/validate-task-graph.mjs --reconcile .ai/specs/task-graphs/<id>.json`
   Add `--node <id>` to scope the check to ONE node's `write_set` (what `/build` step 8 uses);
   without it the check is graph-wide. Add `--base <ref>` to ALSO include a commit range — it is
   additive, the working tree is always included. A clean tree with no `--base` is an error, not a
   pass: it would let this gate be satisfied by committing first.
2. **Read its two lists.**
   - *Unexplained scope* — a changed file in no node's `write_set`. **Blocking.**
   - *Declared but not touched* — a `write_set` entry never written. Not automatically wrong, but
     it means the plan predicted work that did not happen; explain it or amend the graph.
3. **Compare the graph delta.** Actual nodes/edges added, modified, removed vs the approved
   `graph_delta`. Paste the actual `git diff --name-status`.
4. **Check the spec.** Does the implemented behavior still match the normative spec? Precedence is
   spec over graph, always (`.ai/references/task-graph-schema.md`).
5. **Decide.**
   - Everything matches → mark the node(s) `RECONCILED`.
   - Anything diverges → mark `GRAPH_DRIFT`, state precisely what diverged, and stop.

## Resolving GRAPH_DRIFT

`GRAPH_DRIFT` returns to `PROPOSED`, not to `IMPLEMENTING` — drift means the **plan** was wrong, so
the plan is what gets fixed. Then either:

- **revert the stray change** (it was scope creep), or
- **amend the spec and graph** — and if behavior changed, get **human re-approval** before
  continuing. An agent may not approve its own drift resolution.

## Rules

- `/reconcile` never edits source files and never amends the spec. It reports and sets state.
- "It's only a small extra file" is exactly the finding this command exists to catch. Report it.
- A node cannot reach `VERIFIED` without passing through here.

Output: the planned-vs-actual table, the unexplained-scope list (even when empty — say "none"), and
the resulting node states.
