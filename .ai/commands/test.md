---
description: Stage 7 subgraph integration — cross-node, property, invariant, migration, and authorization-isolation testing plus the coverage gate
---

# /test — stage 7, SUBGRAPH INTEGRATION

Invoke the agent-skills:test-driven-development skill.

**Scope boundary:** per-node RED/GREEN belongs to `/build`. `/test` owns everything that only
becomes testable once several verified nodes sit together. Do not re-run the node loop here.

**Precondition:** every node in the slice is `VERIFIED`.

## What to run

1. **Cross-node tests** — behavior that emerges from integrated nodes; the seams `/build` could not
   exercise in isolation.
2. **Property tests** — for anything with an algebraic contract: monetary arithmetic (associativity,
   no precision loss, currency preserved), reconciliation, rounding, ordering.
3. **Invariant suites** — every invariant declared by every node in the slice, run together. An
   invariant that holds per node but breaks in combination is exactly what this stage catches.
4. **Migration and persistence checks** — migrations apply forward, and their compensation applies
   backward. Round-trip persisted data.
5. **Authorization isolation checks** — prove that a query scoped to one household/tenant cannot
   read or write another's rows. Assert the negative case, not just the positive one.
6. **Graph consistency checks** — no new undocumented edges, no orphan nodes, no stale assumptions.
7. **Loop transition checks** — every state transition exercised by the slice behaves per
   `.ai/references/loop-state-machines.md`, including the failure paths.
8. **The coverage gate** — `pnpm test` (>= 80%, enforced pre-commit by
   `.githooks/pre-commit.d/20-test.sh`).

For bug fixes anywhere, use the **Prove-It pattern**: write a test that reproduces the bug, confirm
it FAILS, implement the fix, confirm it PASSES, then run the full suite for regressions.

For browser-facing behavior, also invoke agent-skills:browser-testing-with-devtools.

## Rules

- Paste real output. A summary of a run you did not perform is a contract violation.
- Reuse fixtures; do not duplicate tests that `/build` already proved per node.
- Record genuinely out-of-scope findings in `.ai/specs/98-nice-to-haves.md` rather than silently
  widening the slice.
