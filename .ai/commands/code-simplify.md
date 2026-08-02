---
description: Apply approved reviewer findings and simplify for clarity — preserving invariants, graph edges, provenance and evidence paths
---

# /code-simplify — stage 9

Invoke the agent-skills:code-simplification skill.

Apply the findings approved at `/consensus-review`, and simplify the changed code while preserving
exact behavior.

## Steps

1. Read the contract (`AGENTS.md`) and study project conventions.
2. Identify the target — the reviewed slice unless a broader scope is specified.
3. Understand purpose, callers, edge cases, and test coverage **before touching anything**
   (Chesterton's Fence: if you cannot say why a line exists, you may not delete it yet).
4. Scan for simplification opportunities:
   - Deep nesting → guard clauses or extracted helpers
   - Long functions → split by responsibility
   - Nested ternaries → if/else or switch
   - Generic names → descriptive names
   - Duplicated logic → shared functions
   - Dead code → remove after confirming it is dead
   - Speculative abstraction (one implementation, unused flexibility) → inline it
5. Apply each simplification incrementally — run the affected tests after each change.
6. Rerun the affected gates: node tests, invariant tests, `pnpm exec tsc --noEmit`,
   `pnpm exec biome check`, and `node scripts/validate-task-graph.mjs` if any graph changed.

## Never simplify away

- **Provenance and auditability** — the rule id, document id, or citation attached to a figure.
- **Invariants** and the tests that prove them.
- **Graph edges** — a dependency you find inconvenient is still a dependency.
- **Evidence paths** — the link from requirement to test to output.
- **Authorization filters** — a tenant scope that "looks redundant" is the one that stops a leak.

These are load-bearing. Simplicity that removes the ability to prove correctness is not simplicity,
it is scope loss. If a simplification requires touching one of them, stop and raise it as a spec
question instead.

If tests fail after a simplification, revert that change and reconsider.
