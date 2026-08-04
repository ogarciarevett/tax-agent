# 95 — Eval results

- Task: **P2** · Date: 2026-08-04 · Catalogue: [`EVALS.md`](../../EVALS.md)
- Runner: `pnpm eval` (`scripts/run-evals.mjs`), zero dependencies

Every eval accounts for all four surfaces. `blocked` and `not-implemented` are reported,
never counted as passing, and never affect the exit code.

```
EVAL RESULTS — every eval accounts for all four surfaces

| ID  | Feature                      | UI          | LOG         | DB          | OUT         | Status |
|-----|------------------------------|-------------|-------------|-------------|-------------|--------|
| L1  | Profile interview            | blocked 🚫  | assert ✅    | assert ✅    | assert ✅    | ⚠️     |
| L2  | Bill scan (idempotent)       | n/a         | assert ✅    | assert ✅    | assert ✅    | ✅      |
| L3  | Never-fabricate gate         | n/a         | assert ✅    | assert ✅    | assert ✅    | ✅      |
| L4  | Month report                 | blocked 🚫  | n/a         | assert ✅    | assert ✅    | ⚠️     |
| L5  | Spain rules traceability     | n/a         | n/a         | n/a         | assert ✅    | ✅      |
| L6  | Cron wrapper                 | n/a         | blocked 🚫  | blocked 🚫  | blocked 🚫  | 🚫     |
| L7  | CLI router                   | n/a         | assert ✅    | n/a         | assert ✅    | ✅      |
| P1  | Ledger fact ingest           | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P2  | Budget / monthly cash flow   | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P3  | Tax reserve loop (closed)    | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P4  | Debt plan                    | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P5  | Goal dependencies            | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P6  | Mortgage readiness           | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P7  | Multi-currency               | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P8  | Fiat + crypto assets         | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P9  | Document ingestion           | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P10 | Hybrid retrieval (RRF)       | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P11 | Domain graph explanation     | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P12 | Auditable recommendation     | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P13 | Tenant isolation             | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |
| P14 | No-LLM-arithmetic guard      | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | not-impl ⬜  | ⬜      |

Notes:
  L1 UI  blocked 🚫  opentui needs a real TTY/pty; render proven by manual `pnpm dev`
  L1 LOG assert ✅    7 tests passed
  L1 DB  assert ✅    4 tests passed
  L1 OUT assert ✅    13 tests passed
  L2 LOG assert ✅    15 tests passed
  L2 DB  assert ✅    9 tests passed
  L2 OUT assert ✅    8 tests passed
  L3 LOG assert ✅    14 tests passed
  L3 DB  assert ✅    14 tests passed
  L3 OUT assert ✅    14 tests passed
  L4 UI  blocked 🚫  TUI table view needs a TTY; the rendered string is identical on both paths
  L4 DB  assert ✅    9 tests passed
  L4 OUT assert ✅    18 tests passed
  L5 OUT assert ✅    24 tests passed
  L6 LOG blocked 🚫  needs the user's real crontab + a live agent CLI
  L6 DB  blocked 🚫  same
  L6 OUT blocked 🚫  same
  L7 LOG assert ✅    exit 2 (want 2); usage on stderr: true
  L7 OUT assert ✅    11 tests passed

14/14 asserted surfaces passed · 0 failed · 14 features not implemented (never counted as passing)
```

## Reading this

- **14/14 asserted surfaces passed.** That is the only number that counts.
- **14 platform features report `⬜ not-implemented`** — they are specifications for Phase 1+
  and are excluded from the rate rather than folded in to raise it.
- **L6 (cron wrapper) is 🚫 blocked** on the user's real crontab and a live agent CLI. It has
  no asserted surface, so it contributes nothing in either direction.
- **L1 and L4 are ⚠️** — their UI surface needs a real TTY/pty. The opentui render layer is
  proven by manual `pnpm dev`, which is a documented limitation, not a passing assertion.
