# Loop State Machines

The closed-loop semantics of Pipeline V2. `.ai/pipeline.md` is the normative summary; this file is
the detailed reference for anyone implementing, reviewing, or debugging a loop.

Two loops exist. Do not conflate them.

1. **The node loop** — one node of a task execution graph moving from `PROPOSED` to `VERIFIED`.
   Governed here.
2. **Product feedback loops** — closed financial loops inside the platform (recommendation →
   action → outcome → re-plan). Governed by the `financial-loop-engineering` skill. **Not
   implemented in P0.**

## Node states

| State | Meaning | Terminal? |
|---|---|---|
| `PROPOSED` | compiled from an approved spec; not yet startable | no |
| `READY` | all preconditions hold; may be selected for work | no |
| `IMPLEMENTING` | a writer holds this node | no |
| `TESTED` | node-local tests, typecheck, and lint are green | no |
| `REVIEWED` | reviewed with no blocking finding | no |
| `RECONCILED` | actual impact matches the approved graph delta | no |
| `VERIFIED` | every verification condition holds; committed | **yes** |
| `BLOCKED` | cannot proceed: missing input, unresolved question, external dependency | no |
| `TEST_FAILED` | tests failed after implementation | no |
| `REVIEW_FAILED` | a blocking review finding was raised | no |
| `GRAPH_DRIFT` | actual writes fell outside `write_set`, or spec and graph disagree | no |
| `INVARIANT_FAILED` | a declared invariant test failed | no |
| `SUPERSEDED` | the spec replaced this node | **yes** |

## Transitions

**The authoritative transition table is in `.ai/pipeline.md` → "Node state machine", and the
authoritative readiness rule is in `.ai/pipeline.md` → "Readiness rule".** This file explains them;
it does not restate them. Rules that govern the table:

- **No skipping.** `READY → VERIFIED` without passing through the intermediate states is a contract
  violation, not an optimization. Each state has evidence attached to its entry.
- **Failure goes backward, never forward.** `TEST_FAILED`, `REVIEW_FAILED`, and `INVARIANT_FAILED`
  all return to `IMPLEMENTING`. There is no path from a failure state directly to `VERIFIED`.
- **`GRAPH_DRIFT` returns to `PROPOSED`, not to `IMPLEMENTING`.** Drift means the *plan* was wrong,
  so the plan is what gets fixed — and if behavior changed, a human re-approves it.
- **Only the lead/integrator mutates node state.** Reviewers report; they do not transition.
- **Invalid transitions fail loudly.** Silently correcting an illegal transition hides the bug that
  produced it.

## Failure paths

| Failure | Detected by | Returns to | Recovery |
|---|---|---|---|
| node test fails | `/build` GREEN step | `IMPLEMENTING` | fix implementation; re-prove RED→GREEN |
| invariant test fails | `/build` step 5 | `IMPLEMENTING` | the invariant is the requirement — fix the code, never the invariant, unless the spec is amended and re-approved |
| blocking review finding | `/review` or `/consensus-review` | `IMPLEMENTING` | remediate, then re-review the same node |
| write outside `write_set` | `/reconcile`, `validate-task-graph.mjs --reconcile` | `GRAPH_DRIFT` | either revert the stray change or amend the graph and re-approve |
| spec and graph disagree | `/reconcile`, or any reader | `GRAPH_DRIFT` | reconcile in favour of the **spec** (precedence rule) |
| dependency never verifies | readiness check | `BLOCKED` | resolve upstream, or supersede this node |
| evidence missing at close | `/acceptance` | `REVIEW_FAILED` | collect evidence or downgrade the status honestly. `VERIFIED` is otherwise terminal; this is its only exit besides `SUPERSEDED` |

## Retry

Retry is **bounded to the failing node**. Sibling and downstream nodes are untouched and do not
re-run. There is no global retry: a task-wide restart means the plan was wrong, which is a
`GRAPH_DRIFT` conversation, not a retry.

Repeated failure of the same node (3+ cycles through `IMPLEMENTING`) is a signal that the node is
mis-specified. Stop retrying, mark `BLOCKED`, and take it back to `/spec`.

## Resume

The committed `<task-id>.json` **is** the resume point. A fresh session:

1. reads the task graph;
2. recomputes readiness (`validate-task-graph.mjs --ready`);
3. continues from the first `READY` node.

There is no hidden session state, no in-memory queue, and no reliance on a terminal pane still being
alive. This is what makes the pipeline survivable across context loss, tool restarts, and a
different agent picking the work up.

## Idempotency

| Operation | Idempotent? | Note |
|---|---|---|
| `/map` | yes | pure read |
| `/reconcile` | yes | pure read; the status write is the lead's, not the validator's |
| `validate-task-graph.mjs` | yes | pure read — verified: the graph file is byte-identical before and after |
| `sh scripts/sync-ai-docs.sh` | yes | deterministic, no timestamps. Verified: two runs produce byte-identical trees, and it **prunes** — a stale mirror file is removed on the next run rather than accumulating |
| `/build` | **no** | guarded by node state instead; re-running against a `VERIFIED` node is a no-op by rule |
| `/acceptance` | yes | regenerates the matrix from committed evidence |

## Compensation

A node whose work is **not undone by `git checkout`** must declare it.

- `side_effects: []` → `compensation: []`. This is the normal case for contract and code nodes.
- `side_effects` non-empty → `compensation` must be non-empty and must name the concrete reversal
  (down-migration, cleanup command, manual step). The validator enforces the iff.

Examples of real side effects: applied database migrations, files written outside the repository,
external API state, scheduled jobs installed on the host.

**Compensation is written before the node is built, not after it breaks.** A compensation step
authored during an incident is a guess.

## Approval points

1. **Spec approval** — before GRAPH PLAN.
2. **Graph approval** — before the first `/build`.
3. **Re-approval** — any `GRAPH_DRIFT` resolution that changes behavior.
4. **Consensus verdict** — before `/ship`.

Approvals are human. An agent may not approve its own spec, its own graph, or its own drift
resolution.
