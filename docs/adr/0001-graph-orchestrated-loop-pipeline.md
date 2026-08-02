# ADR 0001 — Graph-orchestrated loop pipeline (Pipeline V2)

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** repository owner (human), lead agent
- **Supersedes:** the linear `/spec → /plan → /build → /test → /review` lifecycle

## Context

The repository governed delivery with a linear, prose-driven lifecycle. Auditing it before starting
financially material work surfaced defects that a prose pipeline cannot prevent:

1. **No machine-readable plan.** `/plan` mentioned a "dependency graph" but serialized only markdown
   prose rows. Nothing could be validated, so nothing was.
2. **Contradictory ownership.** `.ai/pipeline.md` and `consensus-review.md` placed the reviewer
   fan-out in `/consensus-review` ("it lives here, not in `/ship`"); `ship.md`, `agents/README.md`
   and `references/orchestration-patterns.md` placed it in `/ship`. The two panels even named
   different third reviewers.
3. **Duplicate loops.** `/build` and `/test` both invoked the TDD skill and both ran
   RED→GREEN→regression. `/test` wrote no artifact and declared no pipeline position.
4. **Ambiguous commit ownership.** `build.md` said commit; `pipeline.md` said `/ship` commits;
   `ship.md` never mentioned committing.
5. **No mechanism against scope creep.** Nothing compared what was planned against what changed.
6. **A gate that could not fail.** The Definition of Done required coverage ≥ 80%, but tests ran
   only `post-commit`, where the script swallowed failures and exited 0, and no CI existed.

The product being built is a multi-user financial platform where an incorrect figure is the primary
harm. A pipeline whose completion signal is "the agent said it was done" is not adequate for that.

## Decision

Adopt **Pipeline V2**: a graph-orchestrated, loop-engineered, evidence-gated lifecycle.

1. **A task compiles to a committed DAG** at `.ai/specs/task-graphs/<id>.json`, validated by
   `scripts/validate-task-graph.mjs`. Nodes carry read/write sets, invariants, acceptance criteria,
   literal verification commands, and evidence.
2. **Work is readiness-directed**, not step-ordered. A node is selected only when its dependencies
   are `VERIFIED` and no in-flight node holds a conflicting write set.
3. **An explicit node state machine** with enumerated failure transitions. No state may be skipped;
   failure moves backward, never forward.
4. **`/reconcile` is a new stage** comparing the actual diff against declared write sets.
   A changed file in no write set is *unexplained scope* and blocks verification.
5. **`/map` is a new read-only stage** producing the blast radius the spec needs.
6. **Ownership is disambiguated:** `/build` owns the per-node RED/GREEN loop and the per-node commit;
   `/test` owns subgraph integration; `/consensus-review` owns **all** reviewer fan-out; `/ship` is
   mechanical.
7. **Consensus is by mandatory reviewer, not majority.** Majority voting cannot override a
   correctness proof failure.
8. **Evidence is structural.** The validator rejects a `VERIFIED` node with empty evidence.

## Consequences

**Positive.** Plans become validatable; drift becomes detectable mechanically; work survives context
loss because state lives in a committed file rather than a session; parallel safety is derived
rather than asserted; the false-✅ failure mode has a structural defence.

**Negative.** Higher ceremony per task — compiling and validating a graph costs time that a
one-line change does not justify (the skill says so explicitly: do not use it for typo fixes). The
contract grew substantially, and `AGENTS.md` is inlined into every session's context. One new script
must be maintained.

**Accepted risk.** The task-graph JSON is a second description of work alongside the spec. This is
mitigated by an explicit precedence rule — the graph may never override its spec — and by
`SPEC_GRAPH_DRIFT` being a first-class state rather than a warning.

## Alternatives considered

- **Keep the linear pipeline, fix only the contradictions.** Cheaper, and it would have resolved
  defects 2–4. It does nothing for 1, 5, or 6, which are the ones that let incorrect work be
  reported as complete.
- **Build a real workflow engine.** Rejected explicitly. It would own scheduling and execution,
  which humans and slash commands already do adequately, at a large maintenance cost. The chosen
  design stores intent and outcome and executes nothing.
- **Track work in an external tracker.** Rejected as the default because detection was inconclusive
  here (`gh` lacked the `read:project` scope, no Linear configured in-repo). The contract supports
  external ids when a tracker is genuinely present.

## Bootstrap exception

This ADR, and the contract change it records, were produced under the **previous** pipeline.
Pipeline V2 did not govern its own creation. The task graph for that work
(`.ai/specs/task-graphs/P1.json`) marks the affected nodes `bootstrap_exception: true` rather than
implying self-governance. See `.ai/references/task-graph-schema.md`.
