---
name: financial-loop-engineering
description: Design and verify closed financial feedback loops — recommendation to action to outcome to re-plan — with explicit state machines, retry, resume, idempotency, compensation, and human approval before any financially material effect. Use when building or reviewing anything that recommends, schedules, reconciles, or re-plans money over time.
---

# Financial Loop Engineering

A financial loop is closed only when the **outcome** of an action feeds back into the next plan. A
system that recommends and never learns whether the recommendation worked is not a loop; it is a
report generator with opinions.

**The thesis:** in money software, the failure paths *are* the product. A loop judged on its happy
path is untested.

## When to Use

- Building or reviewing tax reserves, payment schedules, budgets, debt plans, goal tracking,
  mortgage readiness, or recurring obligations
- Any workflow where an action's result should change the next decision
- Designing retry, resume, or compensation for anything that touches money
- Reviewing a state machine that governs financially material transitions

**When NOT to use:** pure read paths (rendering a balance, exporting a statement) and the node loop
of the delivery pipeline — that is `graph-orchestrated-delivery`.

## Non-goals

- **Not autonomous action.** No LLM-initiated transfer, trade, or debt payment, ever.
- **Not the ledger's job.** Loops read and propose; the ledger records facts.
- **Not forecasting methodology.** How a projection is computed is domain modelling; this skill
  governs how its result flows, is approved, and is fed back.
- **Not a scheduler implementation.** Cron and queues are infrastructure; the loop is the contract.

## Required inputs

| Input | Why |
|---|---|
| The ledger fact(s) the loop reads | a loop over derived data drifts from truth |
| The explicit **classification** of every value: actual / planned / forecast / simulated / recommended | conflating these is the most expensive mistake in the domain |
| Tenancy scope (user, household) | a loop without a tenant filter is a data leak with a schedule |
| The approval point for any financially material effect | the human gate is part of the design, not a UI detail |
| Declared side effects and their compensation | written before the loop runs, not during an incident |

## Terminology

- **Closed loop** — outcome feeds back into the next plan. **Open loop** — it does not.
- **Financially material** — the step can change money, a tax position, or a commitment.
- **Actual** — observed and recorded. **Planned** — intended by the user. **Forecast** — model
  output. **Simulated** — scenario output under immutable inputs. **Recommended** — system proposal
  awaiting a human.
- **Compensation** — the concrete reversal of a side effect (a down-migration, a cancellation, a
  reversing entry) — never "undo it".
- **Reconciliation** — comparing expected against observed and recording the difference as a fact.

## Procedure

### 1. Draw the state machine before writing code
Name every state, every legal transition, and every failure transition. A loop you cannot draw is a
loop you cannot verify. Record it under `.ai/references/loop-state-machines.md` conventions.

### 2. Classify every value
Tag each value in the loop as actual / planned / forecast / simulated / recommended, and keep the
tag through every transformation. **A forecast that loses its tag becomes a lie the moment someone
reads it as a balance.**

### 3. Place the human approval gate
Identify the first financially material effect and put an explicit human approval immediately before
it. The system may compute, rank, explain, and stage. It may not act.

### 4. Make inputs immutable where scenarios exist
A scenario's inputs are frozen at creation. Re-running a scenario must reproduce it exactly; if
inputs can drift, the recommendation is not reproducible and cannot be audited.

### 5. Design the failure paths
For each state that performs work, answer: what if it dies halfway? what if it runs twice? what if
the external source returns stale data? Write the answer into the transition table.

### 6. Close the loop
Define how the outcome is observed, how it is reconciled against the expectation, and which future
decision consumes the difference. If you cannot name the consumer, the loop is open — say so
explicitly rather than implying feedback that does not exist.

## State transitions

Every financial loop declares, at minimum:

| Concern | Requirement |
|---|---|
| Legal transitions | enumerated; anything not enumerated is illegal and must fail loudly |
| Failure transitions | every working state has one; failure moves backward or to an explicit failed state, never forward to success |
| Retry | bounded, and re-proves its precondition rather than assuming the earlier check still holds |
| Resume | from durable state only — never from in-memory context or a live process |
| Terminal states | explicitly named, including the unhappy terminals |
| Approval | which transitions require a human, and who |

An ambiguous transition (two rules that could both fire) is a defect, not a nuance.

## Graph impact

Loops write to the **financial domain graph** (graph 3): outcome edges, blocker and enabler
relationships, provenance for every recorded fact. They read the **ledger**, which remains the
source of financial truth. A loop must never write a balance into the graph and treat it as
authoritative, and must never source a current balance from RAG.

## Invariants

1. No financial fact is lost or silently mutated — corrections are new facts, not edits.
2. Money is integer minor units; no floating-point arithmetic anywhere in the loop.
3. Every monetary value carries an explicit currency.
4. Every value carries its classification (actual / planned / forecast / simulated / recommended).
5. Every tenant-scoped read and write carries an explicit authorization filter.
6. Scenario inputs are immutable; the same inputs reproduce the same output.
7. Every financially material recommendation carries its evidence and its assumptions.
8. No LLM performs the arithmetic; no LLM initiates a transfer, trade, or payment.
9. Every side effect has a concrete compensation, authored before execution.
10. A stablecoin is never represented as equivalent to a protected bank deposit.
11. A tax estimate is never represented as professional tax advice.

## Mandatory tests

- **Transition tests** — every legal transition, and every *illegal* one rejected loudly.
- **Failure-path tests** — kill the loop at each working state; assert the recovery state.
- **Idempotency tests** — run twice, assert identical result and no duplicated facts.
- **Compensation tests** — apply the side effect, apply its compensation, assert the original state.
- **Property tests on money** — associativity, no precision loss, currency preserved across every
  transformation, rounding applied exactly once.
- **Tenancy isolation tests** — assert the **negative**: household A cannot read or write B's rows.
- **Reproducibility tests** — same scenario inputs produce a byte-identical recommendation.
- **Classification tests** — a forecast never surfaces where an actual is expected.

## Evidence requirements

Paste the transition-table test output, the failure-injection results, the idempotency run (both
runs), and the tenancy negative-case output. For any recommendation surface, show the attached
evidence and assumptions as the user would see them. A loop whose failure paths were "reviewed but
not run" is ⚠️, never ✅.

## Failure modes

| Failure mode | What it looks like | Consequence |
|---|---|---|
| **Open loop sold as closed** | recommendations produced, outcomes never observed | the system never learns; confidence grows without accuracy |
| **Classification collapse** | a forecast rendered in the same widget as a balance | the user acts on a projection believing it is money they have |
| **Retry without re-proving** | retry assumes the earlier precondition still holds | acts on stale state |
| **Duplicate application** | non-idempotent step runs twice after a timeout | double payment, double reserve, double entry |
| **Compensation-by-hope** | `compensation: ["revert the change"]` | nothing concrete to run during an incident |
| **Approval drift** | the gate quietly moves after the effect | the system acted before a human agreed |
| **Silent mutation** | a correction overwrites the original fact | audit trail destroyed; reconciliation impossible |
| **Tenant leak** | a query without the household filter | someone else's finances |
| **LLM arithmetic** | model asked to "add these up" | non-deterministic money |

## Recovery

- **Duplicate application detected** → do not delete. Record a reversing fact, reconcile, and add
  the idempotency key that was missing.
- **Classification leak** → trace every downstream consumer of the mistagged value before fixing;
  the fix is worthless if a cached derivative still carries the wrong tag.
- **Compensation missing at incident time** → stop the loop, do the reversal manually with a human,
  record it as a fact, then write the compensation before restarting.
- **Illegal transition observed in production data** → treat as a correctness proof failure. It
  blocks release regardless of reviewer approvals.
- **Reproducibility broken** → the inputs were not immutable. Freeze them; regard every prior
  recommendation from that path as unauditable and say so.

## Output format

```markdown
## Financial loop — <name>

**Closed?** yes/no — <if no, say what is missing and do not imply feedback>
**Financially material steps:** <list>   **Approval gate:** <before which step, by whom>

### States and transitions
| From | To | Trigger | Failure transition | Approval |
|------|----|---------|--------------------|----------|

### Value classification
| Value | Class | Currency | Source (ledger/model/user) |
|-------|-------|----------|----------------------------|

### Side effects and compensation
| Side effect | Compensation (concrete) | Tested? |
|-------------|-------------------------|---------|

### Evidence
<pasted test output: transitions, failure injection, idempotency, tenancy negative case>

### Known open edges
- <anything not closed, stated plainly>
```

## Worked example

**Tax reserve loop.** Goal: reserve enough each month to cover a quarterly tax payment.

- **Read (ledger):** actual income facts for the period, each with provenance.
- **Compute (deterministic, integer cents):** required reserve from the cited jurisdiction rule —
  not from an LLM. Classification: `forecast`.
- **Recommend:** "move €X to the tax reserve", carrying its evidence (which income facts, which
  rule id) and assumptions (rate, period).
- **Approve:** human. The system may stage a transfer; it may not execute one.
- **Act:** the human executes. The system records the *observed* transfer as an `actual` fact with
  provenance, idempotently keyed so a retry cannot double-record it.
- **Reconcile:** at the quarter, compare reserved actual against the assessed amount. Record the
  difference as a fact.
- **Feed back:** the difference adjusts next quarter's rate assumption. **This is the step that
  closes the loop** — without it, the system would recommend the same wrong number forever.

Failure injection to test: die after staging but before recording (must not double-record on
resume); jurisdiction rule changes mid-quarter (prior recommendations must remain reproducible under
their frozen inputs); household B's income must never enter household A's reserve.

## Integration with pipeline commands

| Command | How this skill applies |
|---|---|
| `/spec` | declares affected loops, classifications, tenancy boundary, and the approval gate |
| `/plan` | loop states become nodes; side effects force `compensation` in the graph |
| `/build` | RED must include a failure-path test, not only the happy path |
| `/test` | property tests on money, idempotency, tenancy negatives, migration round-trips |
| `/review` | `loop-correctness-reviewer` is mandatory when workflow behavior changes |
| `/consensus-review` | financially material logic requires the financial + ledger reviewers too |
| `/acceptance` | a row per loop transition with its evidence |

## Integration with /evolve

`/evolve` compares the documented loop state machines against the transitions the code actually
performs, and flags: states no code can enter, transitions code performs that no document allows,
side effects without compensation, and loops documented as closed whose feedback consumer no longer
exists. Findings are **proposed** in `.ai/specs/97-evolution.md`, never applied silently.
