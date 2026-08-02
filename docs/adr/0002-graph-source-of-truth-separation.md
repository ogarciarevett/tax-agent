# ADR 0002 — Four graphs, separated by authority

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** repository owner (human), lead agent

## Context

"Graph" is used for at least four different things in this project: the repository's file/import
structure, a task's dependency plan, the product's financial relationships, and the traceability
from requirement to proof. They have different authority, different lifetimes, and different
consumers.

Conflating them is not a naming inconvenience — each collapse has a concrete failure:

- Treating the **repository scan** as normative makes "what the code does" indistinguishable from
  "what the code should do", so drift becomes invisible.
- Letting the **task graph** override its spec means an agent can quietly redefine the work it
  agreed to do.
- Letting the **domain graph** hold balances creates a second source of financial truth that will
  drift from the ledger, making every figure unauditable.
- Letting **RAG** answer balance questions returns a number as old as the document it came from.

The product's dominant constraint is that every figure traces to a source. That constraint is
unenforceable without this separation.

## Decision

Define exactly four graphs, each with a stated authority, persistence, derivation, consumer set and
lifecycle (`.ai/context.md` → "The four graphs").

| # | Graph | Authority | Persistence |
|---|---|---|---|
| 1 | **Repository reality** | descriptive only, never normative | ephemeral / gitignored |
| 2 | **Task execution** | normative for execution order; **subordinate to its spec** | committed JSON |
| 3 | **Financial domain** | normative for product relationships | PostgreSQL (Phase 1+) |
| 4 | **Evidence** | normative for "is it done" | committed reports |

Load-bearing rules:

1. **The ledger is the source of financial truth.** The domain graph explains it and never replaces
   it. No authoritative balance is stored in graph 3.
2. **RAG is never authoritative for current financial balances.** It supplies documentary evidence
   and historical context.
3. **The task graph may never override its normative spec.** Precedence: external ticket → task spec
   → project spec → task graph → status. Disagreement is a hard stop (`SPEC_GRAPH_DRIFT`), not a
   warning.
4. **Graphify output is not the financial domain graph.** It is a cache of graph 1.
5. **Requirement without passing evidence is not verified; implementation without a requirement is
   unexplained scope.** Both are enforced, the second mechanically by `/reconcile`.

Graph 3 is **not implemented in P0**. This ADR fixes its boundaries before any schema exists,
because retrofitting the separation after balances have leaked into the graph is far more expensive.

## Consequences

**Positive.** Each graph can be reasoned about, reviewed, and evolved independently. The
`graph-consistency-reviewer` persona has a concrete rulebook. Auditability is structural rather than
aspirational: a figure's provenance chain and a task's evidence chain are separate artifacts with
separate proofs.

**Negative.** Four vocabularies to learn, and contributors will reach for the word "graph" ambiguously
for some time. Reading a balance requires a ledger query even when the domain graph is already loaded
— a deliberate cost.

**Accepted risk.** Graph 3's boundaries are fixed before it is built, so some detail may prove wrong
in practice. Revisiting it goes through `/evolve` and a human-reviewed ADR update, not a silent
schema change.

## Alternatives considered

- **One "knowledge graph" for everything.** Simpler to describe, and the reason this ADR exists:
  it makes the ledger/graph boundary a matter of discipline rather than structure, and discipline
  fails silently.
- **A dedicated graph database for graph 3.** Out of bounds in the initial phases without an ADR and
  measured evidence. PostgreSQL is already the primary datastore; introducing a second one before a
  measurement is a cost with no demonstrated payer.
- **Skip graph 2, keep prose plans.** See ADR 0001 — prose plans cannot be validated.
