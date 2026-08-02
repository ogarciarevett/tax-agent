# <TASK-ID> — <task title>  (per-task spec)

> **Template.** ONE task's spec. Copy to `.ai/specs/<id>-spec.md` (`A1`, `B4`, `P1`, … — letter =
> epic, number = task) ONLY when the repo has NO external backlog. If the repo uses Linear /
> GitHub Projects, DON'T create this file — the ticket IS the spec; cite its id (`ENG-421`, `#123`)
> instead. Written by `/spec`. Delete this note once filled.
>
> This spec is **normative**. The compiled task graph at `.ai/specs/task-graphs/<id>.json` is
> derived from it and **may never override it**. If they disagree: stop, mark the node `GRAPH_DRIFT`,
> reconcile in favour of this file, and get human re-approval if behavior changed.

- Task id: <!-- P1 | ENG-421 | #123 -->
- Status: **DRAFT — awaiting human approval** (reply `approved` or `change: <details>`)
- Backlog source: <!-- local (.ai/specs) | Linear | GitHub Projects --> (state how it was detected)
- Financially material: <!-- yes | no --> · Changes the operating contract: <!-- yes | no -->
  <!-- these two decide the mandatory reviewer panel at /consensus-review -->
- Traces up to: [`01-spec.md`](./01-spec.md) · Indexed in: [`02-plan.md`](./02-plan.md)
- Task graph: [`task-graphs/<id>.json`](./task-graphs/) <!-- created by /plan, after approval -->

## Goal
<!-- TODO: 1–3 sentences. The single outcome this task delivers. -->

## Scope / non-goals
<!-- TODO: what this task does, and what it explicitly does NOT do. -->

## Acceptance criteria (each MUST be testable)
<!-- TODO: one line per criterion — these become the Honest Implementation Report rows in /build and
the requirement column of the evidence graph, each needing pasted evidence to be marked ✅.
Never write a criterion you cannot test: an untestable criterion becomes an unverifiable claim. -->
- [ ] 1.
- [ ] 2.

## Invariants
<!-- TODO: properties that must hold AFTER this task, each with the test that would catch a
violation. An invariant with no test is a wish. For financially material work, name which of the
14 financial correctness constraints in .ai/context.md apply. -->
| Invariant | Test that would catch a violation |
|-----------|-----------------------------------|
|           |                                   |

## Tenancy & security boundaries
<!-- TODO: who may read/write what; the explicit authorization filter involved; the NEGATIVE test
that proves the boundary holds. A positive case proves the feature works, not that the boundary
does. Write "n/a — no tenant-scoped data" if genuinely not applicable, and say why. -->

## Data classification
<!-- TODO: PII / financial fact / derived figure / public. For monetary values, also state the
class: actual | planned | forecast | simulated | recommended. -->

## Graph delta (intended)
<!-- TODO: nodes and edges this task intends to add, modify, or remove — in the financial domain
graph, and/or in the task execution graph. /reconcile compares actual impact against this. -->

## Affected loops
<!-- TODO: which state transitions change behavior (node loop or product loop). Reference
.ai/references/loop-state-machines.md. Write "none" if none. -->

## Blast radius
<!-- TODO: from /map, with file:line citations. Direct writes → transitive importers → tests
covering them → docs asserting the old behavior. "Probably touches X" is not a finding. -->

## Interfaces / data touched
<!-- TODO: endpoints, function signatures, tables, migrations, and files this task changes. -->

## Risks & assumptions
<!-- TODO: the highest-risk decision; what you are assuming and what you trade away. -->

## Open decisions
<!-- TODO: ONLY decisions that genuinely require human judgment, each with a recommended default.
An agent may not approve its own spec. -->
