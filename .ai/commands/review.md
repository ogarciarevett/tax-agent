---
description: Six-axis review of ONE node or integrated subgraph — correctness, readability, architecture, security, performance, graph and loop consistency
---

# /review — the node-level review

Invoke the agent-skills:code-review-and-quality skill.

Review ONE node or ONE integrated subgraph. This is a single-perspective pass run by the lead; the
multi-persona fan-out is `/consensus-review` and lives at stage 8.

## Axes

1. **Correctness** — matches the node's acceptance criteria and the normative spec? Edge cases?
   Tests adequate and actually run?
2. **Readability** — clear names, straightforward logic, no nesting past two levels, functions
   under ~50 lines.
3. **Architecture** — follows existing patterns, clean boundaries, right abstraction level. Push
   back on abstractions with one implementation and on config for values that never change.
4. **Security** — inputs validated with Zod at the boundary, secrets safe, authorization filters
   present on every multi-tenant read and write, no PII in logs.
   (Use the security-and-hardening skill and `.ai/references/security-checklist.md`.)
5. **Performance** — no N+1 queries, no unbounded operations, sane I/O and allocation on hot paths.
   (Use the performance-optimization skill.)
6. **Graph and loop consistency** — the change stays inside the node's declared `write_set`; the
   graph delta still describes reality; declared invariants are actually tested; state transitions
   match `.ai/references/loop-state-machines.md`; no state was skipped.

For financially material changes, additionally check the constraints in `.ai/context.md` →
"Financial correctness constraints": integer money, explicit currency, provenance on every figure,
no LLM arithmetic, and the actual/planned/forecast/simulated/recommended separation.

## Output

Findings categorized **Critical · Important · Suggestion**, each with a specific `file:line` and a
concrete fix recommendation. A finding without a location is not actionable — locate it or drop it.

`/review` does not commit and does not fan out to other personas. A blocking finding sets the node
to **`REVIEW_FAILED` first** — so the failure is recorded, not erased — and only then transitions it
back to `IMPLEMENTING`.
