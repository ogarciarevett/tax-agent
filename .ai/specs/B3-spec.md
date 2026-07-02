# B3 — Scan task prompt + bill JSON contract + verification + file writer  (per-task spec)

- Task id: B3
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
The correctness core: the task prompt the agent CLI executes (search Gmail for billing emails,
return strict JSON), the mechanical never-fabricate verification gate, and the per-bill Markdown
writer for `~/Downloads/tax-agent/YYYY-MM/`.

## Scope / non-goals
**In scope**
- `src/ingest/scan-task.ts` — `buildScanPrompt(watermarkIso, maxThreads=20)`: instructs the agent
  to use its Gmail tools (`factura OR invoice OR receipt OR recibo OR billing`, after watermark,
  skip spam/trash), copy amounts EXACTLY as printed, null when absent, NEVER compute or guess,
  reply with ONLY the `AgentScanReportSchema` JSON (from B1). `parseAgentReply(raw)`: strip code
  fences, slice first `{`..last `}`, `JSON.parse`, zod parse; `buildRetryPrompt(prev, zodError)`
  for the single retry (B5 invokes it).
- `src/ingest/verify.ts` — `normalizeAmountTokens(text)` (both `1.234,56` and `1,234.56`
  readings → cents set); `verifyBill(bill)`: total-in-source containment (reject
  `total_not_in_source`, no row written) · `Σbase+Σvat = total` ±1 cent per VAT line (reject
  `arithmetic_mismatch`) · all amounts found verbatim → `verified=1` else `verified=0`.
- `src/ingest/files.ts` — `writeBillFile(root, bill, extractor)`: `<vendor>-<issueDate>.md`
  (frontmatter: gmail id, extractor, amounts; body: bodyMarkdown + sourceQuote) under
  `root/YYYY-MM/` (month from receivedDate); dirs 0700, files 0600; sanitize `[^\w.-]`; collision
  suffix; `attachmentOnly` → stub .md flagged `adjunto pendiente de descarga manual`.
- Fixtures: canned agent replies — valid · dirty-fenced · invalid-then-valid · fabricated-total ·
  mixed-rate 21+10 · `1.234,56` es formatting.

**Non-goals** — no CLI spawning (B2), no DB writes / orchestration loop (B5).

## Acceptance criteria
- [ ] 1. Fence-stripped/dirty JSON parses; malformed → typed parse error carrying the zod issue.
- [ ] 2. Fabricated total (not present in sourceQuote+bodyMarkdown) → rejected, reason
      `total_not_in_source` (unit test — the never-fabricate gate).
- [ ] 3. `1.234,56` vs `1,234.56` both normalize to 123456 cents (unit test).
- [ ] 4. Mixed-rate arithmetic: 21%+10% lines summing to total pass; ±2 cents off → reject.
- [ ] 5. File writer: correct path/perms/frontmatter; collision adds suffix; attachmentOnly stub
      contains the flag text (tmpdir tests).
- [ ] 6. Gates green: `tsc` · `biome` · coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/ingest/{scan-task,verify,files}.ts`(+tests) · fixtures under `src/ingest/fixtures/`.
Consumes `AgentBillSchema`/`AgentScanReportSchema`/`toCents` from `src/domain/bill.ts` (frozen, B1).

## Risks & assumptions
- Trust boundary: source text comes from the same agent session (honest limitation, see 01-spec);
  the gate still kills arithmetic fabrication and total/quote mismatch.
