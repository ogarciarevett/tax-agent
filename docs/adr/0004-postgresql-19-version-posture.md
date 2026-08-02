# ADR 0004 — PostgreSQL version posture: develop against 19, run 18

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** repository owner (human), lead agent
- **Review trigger:** PostgreSQL 19 general availability

## Context

PostgreSQL is the locked primary datastore, and also carries pgvector for embeddings and the lexical
side of hybrid retrieval. The version choice therefore affects storage, retrieval, and migrations
simultaneously.

Verified status at the time of this decision (postgresql.org, 2026-08-02):

- **PostgreSQL 19 is in Beta 2**, released 2026-07-16. It is **not generally available**.
- PostgreSQL 18 is the current stable major.
- Each major receives fixes for five years from initial release; majors ship roughly annually.

There is a genuine tension. Building against 18 and migrating later risks discovering incompatibility
after schema and query patterns have set. Declaring 19 the production database today would mean
running prerelease software under people's financial records — and, worse, writing a contract that
*describes* a beta as production-ready, which is the kind of quiet inaccuracy this project's honesty
rules exist to prevent.

## Decision

Split the target by purpose, and say so explicitly in the contract.

1. **PostgreSQL 19 is the development and compatibility target.** New schema and queries are
   authored with 19 in mind and exercised against it.
2. **Production posture remains the latest supported PostgreSQL 18 release** until 19 reaches
   general availability *and* passes compatibility validation here.
3. **During the transition, migrations and core queries are evaluated against both versions.**
4. **The contract must not describe a PostgreSQL beta as production-ready.** `.ai/context.md` states
   the beta status and its date.
5. **Production use of prerelease database software is out of bounds** without explicit human
   approval, recorded alongside the "out of bounds" list in `.ai/context.md`.
6. **Revisit at GA** through `/evolve` and a human-reviewed update to this ADR — not by silently
   editing the contract.

Related and deliberately left open: the concrete lexical-ranking implementation. PostgreSQL's
`ts_rank` **must not be called BM25 unless it actually is BM25**. The implementation must be
identified, benchmarked, and documented in its own ADR **before** retrieval production code begins.
pgvector remains the vector store; no separate vector database, Elasticsearch, or OpenSearch without
an ADR and evidence.

## Consequences

**Positive.** Real financial data never sits on prerelease software. Compatibility problems surface
during development rather than at migration time. The contract states a verifiable fact with a date
rather than an impression.

**Negative.** Two versions must be available in development, and CI (once it exists) will need a
matrix. Features exclusive to 19 cannot be depended on in production paths until GA, so some code
will carry a compatibility seam for a while.

**Accepted risk.** The dual-target period costs setup effort and some duplicated test time. This is
cheaper than either a late migration or an incident on beta software.

## Alternatives considered

- **Target 18 only.** Simplest today; defers all compatibility discovery to a migration that would
  land after the schema has hardened.
- **Target 19 only, including production.** Rejected: prerelease software under financial records,
  and it would require the contract to misrepresent a beta.
- **Wait for GA before choosing.** Rejected as a non-decision — schema work starts in Phase 1, and
  "we'll decide later" is how a default gets chosen by accident.

## Verification

The factual claims above were checked against postgresql.org's versioning and news pages on
2026-08-02, which announced "PostgreSQL 19 Beta 2 Released!" dated 2026-07-16. Re-verify before
relying on this ADR after that date — its whole purpose is to expire.
