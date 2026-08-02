---
description: Implement ONE READY node of a task graph — prove RED, build, prove GREEN, review, reconcile, then commit only when VERIFIED
---

# /build — stage 6, the node loop

Invoke the agent-skills:incremental-implementation skill alongside
agent-skills:test-driven-development, and the `graph-orchestrated-delivery` skill.

**`/build` operates on ONE node, not a whole task.** Select it with the readiness rule:

```
node scripts/validate-task-graph.mjs --ready .ai/specs/task-graphs/<id>.json
```

Pick a `READY` node — prefer the critical path and high-risk proof nodes. Never pick a node with
unverified dependencies. Never hold two nodes with overlapping write sets.

## The loop

1. **Read the approved node contract** — its acceptance criteria, invariants, `write_set`, and
   verification commands. Mark the node `IMPLEMENTING`.
2. **RED.** Write (or identify) a failing test for the expected behavior. **Run it and paste the
   failure.** A test that passes on first run proves nothing — that is the point of pasting it.
   Where behavior genuinely is not testable (pure documentation), say so explicitly and name the
   `file:line` that will serve as evidence instead.
3. **BUILD.** Implement the minimum change. **Touch only files in the node's `write_set`** — a
   write outside it is unexplained scope and will fail `/reconcile`.
4. **GREEN.** Run the node's tests and paste the passing output.
5. **Invariants.** Run the node's declared invariant tests. Paste the output.
6. **Gates.** Run the required type/lint checks (`pnpm exec tsc --noEmit`, `pnpm exec biome check`)
   and the node's `verification_commands`. Paste the output.
7. **`/review`** the node — six axes including graph consistency and loop correctness.
8. **`/reconcile --node <id>`** — planned vs actual impact, scoped to THIS node's write_set:
   `node scripts/validate-task-graph.mjs --reconcile --node <node-id> .ai/specs/task-graphs/<id>.json`
9. **VERIFY.** Only when every gate above passes: set `status: "VERIFIED"`, attach the `evidence`
   entries, and update `.ai/specs/task-graphs/<id>.json`. The validator rejects a `VERIFIED` node
   with empty evidence — do not try to route around it.
10. **Commit.** One atomic commit per verified node, citing the task and node id. **Committing
    before the node is `VERIFIED` is a contract violation.** Never push.

If a step fails: **first write the failure state** (`TEST_FAILED` from step 4, `INVARIANT_FAILED`
from step 5, `REVIEW_FAILED` from step 7, `GRAPH_DRIFT` from step 8) into the node, so the failure
is recorded rather than erased. Then follow agent-skills:debugging-and-error-recovery, append
`symptom → root cause → fix` to `.ai/memory.md`, and transition back to `IMPLEMENTING`. Failure moves backward, never
forward. Three failed cycles on one node means the node is mis-specified — mark it `BLOCKED` and
take it back to `/spec`.

`/build` does **not** own: cross-node or integration testing (`/test`), reviewer fan-out
(`/consensus-review`), or selecting more than one node at a time.

## Honest Implementation Report (MANDATORY — see "Honesty protocol" in the contract)

Close every node with this report. **Over-claiming is a contract violation; under-claiming is
fine.** Build the table from the node's acceptance criteria:

| # | Acceptance criterion | Status | Evidence (pasted command output / `file:line`) |
|---|----------------------|--------|-------------------------------------------------|
| 1 | …                    | ✅/⚠️/🔧/❌/🚫 | … |

- **Status legend:** ✅ verified · ⚠️ partial · 🔧 stubbed/mocked · ❌ not done · 🚫 blocked.
  A row is ✅ ONLY when the actual output proving it is pasted — no evidence means NOT ✅.
- **Honest Implementation Metric:** `verified ✅ ÷ total = NN%`. A node is done only at 100%
  with evidence on every row.
- **Unverified:** anything you asserted but did not actually run/prove here.
- **Could-not-do:** anything you could not perform (missing creds, no network, env limits,
  ambiguous spec). State it plainly — NEVER fabricate output or claim a run you did not execute.
