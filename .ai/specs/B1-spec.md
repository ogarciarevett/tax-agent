# B1 — Bill domain + AgentRunner seam + migrations + ingest repo  (per-task spec)

- Task id: B1
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
The frozen foundation Wave-2 teammates build on: the bill domain vocabulary (zod), the one-method
`AgentRunner` seam, a `user_version` migrations layer (paying the debt flagged in
[`03-review.md`](./03-review.md) before the ingestion loop lands), and a prepared-once ingest repo.

## Scope / non-goals
**In scope**
- `src/domain/agent.ts` — `interface AgentRunner { run(prompt: string): Promise<string> }`.
- `src/domain/bill.ts` — `BillCategorySchema` enum; printed-amount string schema
  (`^\d+(?:[.,]\d{1,2})?$`); `toCents()` exact string parsing (no floats, both `,`/`.` decimal);
  `AgentBillSchema` + `AgentScanReportSchema` (the agent JSON contract:
  `{bills:[{gmailMessageId, receivedDate, vendor, issueDate, currency, total, vatLines:[{ratePct,
  base, vat}], category, sourceQuote, bodyMarkdown}], attachmentOnly:[{gmailMessageId,
  receivedDate, vendor|null}], notBills:[], hasMore}` — attachment-only emails carry no verifiable
  amounts, so they are their own array and NEVER become bill rows, only an
  `attachment_pending` email + a stub file); `BillRecord` (stored shape, cents as integers).
- `src/storage/migrations.ts` — `PRAGMA user_version` + ordered SQL array, each step inside
  `db.transaction()`. v1 = verbatim current `profile` DDL (`IF NOT EXISTS` → the existing on-disk
  DB adopts cleanly). v2 = `emails` (gmail_message_id UNIQUE, received_date, status CHECK
  billed|attachment_pending|not_a_bill|failed, error code) + `bills` (email_id FK, vendor,
  issue_date, currency, total_cents INTEGER, vat_lines JSON, category, file_path, source_quote,
  extractor, verified, extracted_at) + issue_date index.
- `src/storage/db.ts` — drop inline DDL → `migrate(db)`; add `synchronous=NORMAL`,
  `busy_timeout=5000`.
- `src/storage/ingest-repo.ts` — `createIngestRepo(db)`: statements prepared once in the factory
  closure; `hasEmail`, `insertEmailWithBill` (one transaction), `insertEmail(status)`,
  `latestEmailDate`, `listBillsForMonth(month)`, `listBillsForYear(year)` (re-validates vat_lines
  with zod on read).

**Non-goals** — no agent spawning (B2), no prompt/verification (B3), no report math (B4).

## Acceptance criteria
- [ ] 1. Migration tests: fresh `:memory:` → `user_version=2` + tables exist; legacy v0 DB with a
      profile row → adopts with data intact; re-run idempotent.
- [ ] 2. `toCents` unit tests: `"123,45"`→12345 · `"123.45"`→12345 · `"1234"`→123400 (whole
      units) · `"7,5"`→750 (one decimal). Non-matching strings rejected by the amount schema.
- [ ] 3. Repo tests on `:memory:`: bill round-trip equals; `hasEmail` dedupe; transaction
      atomicity (failing bill insert rolls back the email row); month/year listing boundaries.
- [ ] 4. Existing A1 tests still green (profile table via migrations now).
- [ ] 5. Gates green: `tsc` · `biome` · coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/domain/{agent,bill}.ts`(+tests) · `src/storage/{migrations,ingest-repo}.ts`(+tests) ·
`src/storage/db.ts`

## Risks & assumptions
- Money is ALWAYS integer cents in storage; printed strings only at the agent boundary.
- `vat_lines` JSON blob follows the `profile.data` precedent (nothing queries by rate in SQL).
