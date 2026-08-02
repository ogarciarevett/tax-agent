---
name: financial-graph-engineering
description: Model the financial domain graph — relationships, dependencies, blockers, enablers, exposure, provenance and explanations — in PostgreSQL, strictly separate from the ledger and never authoritative for balances. Use when designing or reviewing financial relationships, goal dependencies, exposure analysis, or any explanation of why a financial outcome holds.
---

# Financial Graph Engineering

The financial domain graph (graph 3 of four) answers **"why"** and **"what depends on what"**. The
ledger answers **"what is true"**. Keeping those two questions in separate systems is the single
most important structural decision in this product.

**The thesis:** the graph explains the ledger. The moment it starts *asserting* balances, every
number in the product becomes unauditable.

## When to Use

- Modelling goal dependencies, blockers, and enablers
- Representing exposure (currency, institution, asset class, counterparty)
- Recording provenance chains from a figure back to its source document or rule
- Building explanations: "this goal is blocked by that liability"
- Reviewing any change that adds nodes or edges to the domain graph

**When NOT to use:** recording a financial fact (that is the ledger), retrieving a document (that is
RAG), or planning delivery work (that is `graph-orchestrated-delivery`).

## Non-goals

- **Not a ledger.** No balances, no authoritative amounts, no source of financial truth.
- **Not a retrieval index.** RAG supplies documentary evidence; the graph supplies relationships.
- **Not a graph database project.** PostgreSQL holds it. A dedicated graph DB is out of bounds in
  the initial phases without an ADR and evidence.
- **Not implemented in P0.** This skill governs Phase 1+ work; writing product schema now is out of
  scope.

## Required inputs

| Input | Why |
|---|---|
| The ledger facts the graph references | edges must point at real facts, by id |
| Tenancy scope (user, household) | every node and edge is tenant-owned |
| Provenance for every asserted relationship | an unexplained edge is an opinion |
| The question the graph must answer | a graph built without a query in mind grows edges nobody reads |

## Terminology

- **Node** — an entity: account, institution, liability, asset, goal, obligation, jurisdiction,
  household member.
- **Edge** — a typed, directed relationship: `blocks`, `enables`, `funds`, `secures`,
  `exposes_to`, `derived_from`, `evidenced_by`.
- **Blocker / enabler** — an edge that prevents or permits a goal reaching its target.
- **Exposure** — aggregate sensitivity to a factor (a currency, an institution, an asset class).
- **Provenance edge** — links a derived figure back to the fact or rule that produced it.
- **Explanation** — a path through the graph, rendered as reasoning, with every hop citable.

## Procedure

### 1. Start from the question, not the schema
Write the queries first: "why is this goal blocked?", "what is my exposure to this institution?",
"where did this number come from?". Every node and edge type must be justified by a query. An edge
type nothing queries is speculative schema.

### 2. Separate reference from assertion
A node that mirrors a ledger entity holds its **id**, not its balance. Balances are read from the
ledger at query time. If you find yourself denormalizing an amount into the graph, stop: you are
building a second source of truth that will drift.

### 3. Type every edge, and make direction meaningful
`blocks` and `blocked_by` are not both needed. Pick one direction and be consistent, or the same
relationship will be written twice and disagree with itself.

### 4. Attach provenance at write time
Every asserted edge records why it exists: a rule id, a document id, a user statement, or a
computation with its inputs. Provenance added later is reconstruction, not evidence.

### 5. Version, don't overwrite
Relationships change (a goal's blocker is resolved). Record the change as a new version with a
validity period. Overwriting destroys the ability to explain a past recommendation.

### 6. Scope every query by tenant
Every read and write carries an explicit household/tenant filter — in the query, not in application
logic that "always passes the right id".

## State transitions

Graph elements are versioned rather than mutated:

| From | To | Trigger | Note |
|---|---|---|---|
| — | `asserted` | a fact, rule, or user statement creates the edge | provenance required at creation |
| `asserted` | `superseded` | a newer version replaces it | the old version remains queryable |
| `asserted` | `retracted` | its basis was withdrawn or found wrong | never deleted; retraction is itself a fact |
| `asserted` | `expired` | its validity period ended | time-based, not an error |

There is no `deleted`. A financial explanation that can vanish is not auditable.

## Graph impact

This skill *is* graph 3. Its relationship to the other three:

- **Ledger (not a graph)** — the source of financial truth. The domain graph references it and never
  replaces it.
- **RAG** — supplies documentary evidence and historical context. Never authoritative for current
  balances. A provenance edge may point at a retrieved document; the *balance* still comes from the
  ledger.
- **Evidence graph (4)** — proves the delivery work was done. Unrelated to the product's runtime
  graph; do not merge the two vocabularies.

## Invariants

1. **The graph never replaces the ledger.** No authoritative balance lives here.
2. **RAG is never authoritative for current balances.**
3. Every node and edge is tenant-owned and queried under an explicit authorization filter.
4. Every asserted edge carries provenance.
5. Edges are versioned and never destructively deleted.
6. Any monetary value that does appear is integer minor units with an explicit currency, and is
   classified (actual / planned / forecast / simulated / recommended).
7. Every explanation path is fully citable — no hop asserted without a source.
8. Edge direction is canonical; the same relationship is never stored twice in opposite directions.
9. No LLM writes an edge without a human-visible basis; no LLM-generated SQL executes outside the
   controlled query layer.

## Mandatory tests

- **Separation test** — assert that no query path returns a balance sourced from the graph.
- **Provenance completeness** — every edge row has a non-null, resolvable provenance reference.
- **Tenancy isolation** — the **negative** case: a traversal starting in household A never reaches a
  household B node, including through shared institutions.
- **Cycle behavior** — the domain graph *may* legitimately contain cycles (mutual dependency);
  traversals must terminate. Test with a deliberately cyclic fixture.
- **Versioning** — superseding an edge preserves the prior version and its queryability.
- **Explanation reproducibility** — the same inputs produce the same explanation path.
- **Migration round-trip** — forward migration and its compensation restore the original schema.

## Evidence requirements

Paste: the tenancy negative-case query result, the provenance-completeness count (must be zero
missing), the cyclic-traversal termination proof, and a rendered explanation path with every hop's
citation. A claim that "the graph is separate from the ledger" needs a query that would have failed
if it were not.

## Failure modes

| Failure mode | What it looks like | Consequence |
|---|---|---|
| **Ledger absorption** | balances denormalized into graph nodes | two sources of truth; silent drift; unauditable figures |
| **RAG as truth** | a balance answered from a retrieved PDF | the number is as old as the document |
| **Unexplained edges** | edges written with null provenance | explanations that cannot be defended |
| **Destructive updates** | edge overwritten when a relationship changes | past recommendations become inexplicable |
| **Speculative schema** | edge types nothing queries | maintenance cost with no reader |
| **Bidirectional duplication** | `blocks` and `blocked_by` both stored | the two disagree eventually |
| **Traversal blowup** | unbounded recursive query on a cyclic graph | timeouts under real data volume |
| **Cross-tenant traversal** | path through a shared institution into another household | data leak |
| **Premature graph DB** | "Postgres can't do this" without measurement | out-of-bounds dependency, no evidence |

## Recovery

- **Balance found in the graph** → treat as a correctness proof failure. Remove the column, re-source
  from the ledger, and audit every figure that was ever read from it.
- **Missing provenance discovered** → do not backfill with guesses. Mark those edges `retracted`
  pending a real source, and state the gap.
- **Cross-tenant path found** → stop, treat as a security incident, add the negative-case test that
  would have caught it, then fix.
- **Traversal blowup** → bound the depth and add the index; do not reach for a graph database
  without a measurement and an ADR.
- **Destructive update already shipped** → prior explanations are unrecoverable. Say so plainly in
  the acceptance report rather than reconstructing plausible history.

## Output format

```markdown
## Domain graph change — <name>

**Question(s) this serves:** <the queries that justify it>
**Tenancy:** <scope>   **Ledger interaction:** <which facts referenced, by id>

### Node types
| Type | Key | Tenant-owned | References ledger? |
|------|-----|--------------|--------------------|

### Edge types
| Type | Direction | Provenance source | Versioned | Query that reads it |
|------|-----------|-------------------|-----------|---------------------|

### Separation proof
<pasted query result showing no balance is sourced from the graph>

### Evidence
<pasted: provenance completeness, tenancy negative case, traversal termination>
```

## Worked example

**"Why can't I buy a house yet?"**

Wrong shape: a `mortgage_readiness` node holding a computed score and the user's deposit balance.
Now the balance exists in two places, and the score's basis is invisible.

Right shape:

- Nodes: `goal:house_purchase`, `liability:car_loan`, `account:savings` (id only), `obligation:tax_q3`.
- Edges: `liability:car_loan --blocks--> goal:house_purchase` (provenance: rule
  `es.mortgage.dti_limit`, plus the loan fact id); `account:savings --funds--> goal:house_purchase`
  (provenance: user designation); `obligation:tax_q3 --blocks--> goal:house_purchase` (provenance:
  computed from cited rule + income fact ids).
- The **deposit amount** is read from the ledger at query time, never stored on the edge.
- The explanation is the path: *"blocked by car_loan (debt-to-income limit, rule es.mortgage.dti_limit)
  and by tax_q3 (reserve required, computed from income facts #412, #418)"* — every hop citable.

When the car loan is repaid, the edge is `superseded`, not deleted — so a recommendation made last
March can still be explained next March.

## Integration with pipeline commands

| Command | How this skill applies |
|---|---|
| `/spec` | declares the graph delta, node/edge types, tenancy and data classification |
| `/plan` | schema and migration nodes carry `side_effects` and therefore `compensation` |
| `/build` | RED includes the tenancy negative case before the traversal is written |
| `/test` | traversal termination, provenance completeness, migration round-trip |
| `/review` | `graph-consistency-reviewer` checks the four-graph separation |
| `/consensus-review` | mandatory financial + ledger reviewers when figures are involved |
| `/acceptance` | a row per graph invariant with its proving query |

## Integration with /evolve

`/evolve` compares the declared domain-graph schema against the migrations actually in the
repository, and flags: edge types with no reader, nodes holding denormalized amounts, edges without
provenance, and destructive updates where versioning was specified. While graph 3 is unimplemented,
this dimension reports "not implemented" rather than inventing findings. Proposals go to
`.ai/specs/97-evolution.md`, never applied silently.
