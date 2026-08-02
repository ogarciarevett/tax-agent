# 00 — Requirements

> Raw requirements. Design happens in `01-spec.md`.
> **Status: pipeline / bootstrap phase — the platform below is NOT implemented.**
> See "Legacy CLI (v0)" for what does exist today.

## Problem

**Tax Agent — Financial Intelligence Graph.** A reusable, multi-user and multi-household financial
intelligence platform. It should let a household understand its whole financial position — accounts,
debts, assets, obligations, goals, taxes — from documents and facts it already has, and explain
every conclusion it reaches.

The failure this product exists to prevent is a confident wrong number. Every figure must trace to a
source document or a cited rule, or it must not be shown.

## Functional requirements

| # | Requirement |
|---|---|
| R1 | Deterministic financial accounting over **append-only financial facts** |
| R2 | Budgeting and monthly cash flow |
| R3 | Debt planning |
| R4 | Tax reserves and payment schedules |
| R5 | Goal dependencies — blockers and enablers |
| R6 | Mortgage readiness |
| R7 | Multi-currency accounts |
| R8 | Fiat and crypto assets |
| R9 | Document ingestion |
| R10 | Hybrid lexical + vector retrieval with reciprocal-rank fusion |
| R11 | Graph-based financial relationships (the financial domain graph) |
| R12 | Closed financial feedback loops — outcome feeds back into the next plan |
| R13 | Auditable AI recommendations |
| R14 | Evidence-backed explanations for every conclusion |

### Multi-tenancy (R15)

The platform must support **arbitrary**: users · households · household members · accounts ·
institutions · liabilities · assets · jurisdictions · currencies · financial goals · tax calendars ·
risk tolerances · recurring obligations.

The initial owner's real financial data may later be represented as private seed/demo data.
**It must never become universal business logic.**

## Non-functional requirements / constraints

### Financial correctness (the dominant constraint)

| # | Constraint |
|---|---|
| C1 | No loss or silent mutation of financial facts |
| C2 | Deterministic monetary calculations |
| C3 | No floating-point money arithmetic |
| C4 | Explicit currency on every monetary value |
| C5 | Household and tenant isolation |
| C6 | Provenance for every imported fact |
| C7 | No LLM-only financial arithmetic |
| C8 | No LLM-initiated transfer, trade, or debt payment |
| C9 | Explicit separation between actual, planned, forecast, simulated, and recommended |
| C10 | Immutable scenario inputs |
| C11 | Reproducible recommendations |
| C12 | Evidence and assumptions attached to every financially material recommendation |
| C13 | No stablecoin represented as equivalent to a protected bank deposit |
| C14 | No tax estimate represented as professional tax advice |

### Architecture

- The **ledger** is the source of financial truth.
- The **financial domain graph** represents relationships, dependencies, constraints, causal and
  explanatory connections, goal blockers and enablers, provenance, and exposure.
  **The graph must never replace the ledger.**
- **RAG** provides documentary evidence and historical context.
  **RAG must never be the authoritative source of current financial balances.**
- Jurisdiction rules live behind a per-jurisdiction module so a second jurisdiction is additive.

### Platform

- Stack locked in `.ai/context.md`: TypeScript 7 · Bun · Next.js App Router · React Server
  Components · PostgreSQL · pgvector · Drizzle · Zod · shadcn/ui · Tailwind · OpenTelemetry ·
  structured logging · Vitest · Playwright · Docker Compose · committed SQL migrations.
- PostgreSQL 19 is the development/compatibility target; production posture stays on the latest
  supported PostgreSQL 18 until 19 is GA (ADR 0004).
- ≥ 80% test coverage, enforced pre-commit.

## Out of scope / non-goals

- **Not in P0:** any application code, database schema, Next.js app, or UI. P0 delivers the
  operating contract and pipeline only.
- No direct filing or submission to a tax authority.
- No autonomous financial action — the system recommends; a human acts.
- No dedicated graph database, external vector database, Elasticsearch or OpenSearch in the initial
  phases (ADR 0002; requires an ADR and evidence).
- No production use of prerelease database software without explicit human approval.
- No LLM-generated SQL executed outside a controlled query layer.

## Legacy CLI (v0) — shipped, frozen, not the platform above

`src/**` contains a working single-user, Spain-only local-first CLI (Node 22 · pnpm ·
better-sqlite3 · opentui · local LLM CLI subprocesses) providing `interview`, `scan`, and `report`.
Epics A1 and B0–B7 are complete, tested, and green.

It is **frozen** and **not deleted**. It is the reference implementation for two constraints the
platform inherits — integer-cents money (C3) and rule-id/document-id provenance on every emitted
figure (C6, C14). Phase 1 ports its durable assets (`src/countries/es/rules.ts`, the integer-cents
model, the `figure(label, cents, ruleIds)` pattern) into the new jurisdiction plugin; the legacy tree
retires only once that port is verified.

Its historical requirements are preserved in `.ai/specs/99-acceptance.md` and the A/B task specs.

## Acceptance criteria (seed — platform)

- A household's financial position is assembled from append-only facts, with every figure traceable
  to a document or cited rule.
- Two households in the same deployment cannot read or write each other's data — proven by a
  negative test.
- A recommendation carries its evidence and assumptions, and re-running it with the same frozen
  inputs reproduces it exactly.
- No monetary value anywhere is a floating-point number, and every one carries its currency.
- A tax reserve loop observes its outcome and feeds the difference into the next period's plan.
- Retrieval combines lexical and vector results by reciprocal-rank fusion, with the lexical
  implementation named accurately and benchmarked.
- Adding a second jurisdiction requires no change to shared code.
