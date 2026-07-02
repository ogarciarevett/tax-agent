# 03 — Consensus review (project finish)

## Epic B — daily billing scan via subscription agent-CLI (2026-07-02)

- Scope: tasks **B0–B7** — CLI router · bill domain/migrations/repo · agent-CLI adapter ·
  scan task + never-fabricate gate + file writer · `es` country module · scan orchestration + cron ·
  month report + TUI table · integration/E2E
- Panel: `code-reviewer` · `security-auditor` · `performance-reviewer` (parallel teammates)
- Gate: 2-of-3 APPROVE → **security APPROVE · performance APPROVE · code REQUEST_CHANGES →
  all findings applied same pass → re-verdict requested** (see below)
- Traces to: [`B0-spec.md`](./B0-spec.md)…[`B7-spec.md`](./B7-spec.md) · deferred items in
  [`98-nice-to-haves.md`](./98-nice-to-haves.md)

## 🔵 Verdict
Security and performance seats approved outright (perf: all pre-documented debt from the A1 review
verified paid, hot paths bounded, WAL/NORMAL/busy_timeout correct; sec: no CRITICAL/HIGH — no-shell
subprocess, stdin prompts, parameterized SQL, 0700/0600 perms, least-privilege Gmail allowlist).
The code seat found one CRITICAL that shipped green through a test gap: **quarterly Modelo 303/130
figures were computed from month-only bills** (silent understatement on the default command). Fixed
this pass with `listBillsForQuarterContaining` + regression tests. All MED/LOW findings from all
three seats were applied in the same pass (below).

## ⚫/⚪ Findings — applied this pass
| Src | Finding | Fix |
|-----|---------|-----|
| code CRITICAL | `report` fed month-only bills to `buildMonthReport` → T-quarter Modelo 303/130 lines understated the quarter | `listBillsForQuarterContaining(month)` in `ingest-repo.ts`; `cli/report.ts` passes the quarter set (es module slices month figures itself); regression tests month-vs-quarter (`es/report.test.ts`, `ingest-repo.test.ts`) |
| code MED | € formatting on the non-EUR "Excluidas" figure; mixed currencies would collapse into one sum | Exclusions are now per-currency NOTES with bill ids (`nonEurNotes`), never an amount figure; also on the empty-month path |
| code MED | Never-fabricate gate over-accepted bare integers (a "20" inside a date validated total "20,00") | Bare-integer tokens count as money only with a currency marker (€/$/£/EUR/USD/GBP) within ~4 chars (`verify.ts`); scenario tests added |
| code LOW | VAT line rate never checked against its own base/vat | Per-line `|vat − base×rate/100| ≤ 1c` else `arithmetic_mismatch` |
| code LOW | Bill files filed by receivedDate month but reported by issueDate month | `files.ts` files under `issueDate ?? receivedDate` — same grouping as the report |
| code+sec LOW | `AgentCliFailedError` message embedded a 200-char stderr excerpt → could reach cron.log | Message = provider + exit code only; excerpt is a property, surfaced only under DEBUG |
| sec MED | codex spawned with no sandbox → provider-parity gap for indirect prompt injection from hostile emails | `--sandbox read-only` pinned on the codex argv |
| sec LOW | Gmail id validated by length only → audit-log/file-content injection surface | `GmailIdSchema` charset regex `^[A-Za-z0-9_-]+$` |
| sec LOW | Pre-existing downloads root not tightened (mkdir mode applies only on creation) | `chmodSync(root, 0o700)` after mkdir (override + default paths) |
| perf SUG | `idx_bills_issue_date` unused (non-sargable COALESCE filter) — write cost for zero read benefit | Removed from the (uncommitted) v2 migration; dropped from local DBs |
| code NIT | Stale "Defaults to 300_000ms" JSDoc | Updated (default is now 600_000ms / env-tunable) |

Also fixed during integration (found by the live E2E, pre-panel): one 20-thread scan batch
exceeded the 300s CLI timeout → batch default 8 threads + default timeout 600s +
`TAX_AGENT_LLM_TIMEOUT_MS` env override.

## 🟡/🟢 Findings — deferred (recorded in `98-nice-to-haves.md`)
- Same-day >1-batch billing threads may defer to the next daily run (watermark granularity).
- `TraceableFigure` lacks a currency field (cosmetic after the notes fix).
- Independent second-agent verification of sourceQuote provenance.
- `TAX_AGENT_DB` path override for cleaner isolated E2E runs.

Post-fix gate: **190 tests pass (1 skipped) · coverage 98.33% stmts / 90.03% branch / 96.47%
funcs / 98.78% lines · tsc + biome clean.** Live E2E: real Gmail scan → 2 bills stored
(verified=1) → July table with cited es figures rendered from real data.

---

## Epic A — A1 opentui profile interview (2026-07-01)

- Scope: task **A1** — opentui profile interview + local persistence
- Panel: `code-reviewer` · `security-auditor` · `performance-reviewer` (parallel sub-agents)
- Gate: 2-of-3 APPROVE → **met unanimously (3/3 APPROVE)**
- Traces to: [`A1-spec.md`](./A1-spec.md) · fixes tracked in [`98-nice-to-haves.md`](./98-nice-to-haves.md)

### 🔵 Verdict
**APPROVE.** Foundation slice is clean and well-factored: the zod boundary → pure `answersToProfile`
→ SQLite split makes the untestable TTY layer genuinely thin, every acceptance criterion is
covered, and the no-PII-in-logs / parameterized-SQL constraints hold. No CRITICAL/HIGH/MEDIUM
security or performance blockers. One HIGH usability finding (validate-at-end discarded all answers)
was fixed in this pass, not deferred.

### ⚫/⚪ Findings — applied this pass
| Src | Finding | Fix |
|-----|---------|-----|
| code HIGH | Interview validated only at the end → one bad answer dumped the raw `ZodError` and lost every answer | `validateAnswer()` per-question + re-ask loop in `runInterview`, error surfaced via `Prompter.note()` (`interview.ts`) |
| code MED · self | `Prompter.note()` was dead code | Wired into the re-ask feedback above — now used, not deleted |
| code MED | Optional fields couldn't be cleared during review/edit (empty fell back to prefill) | Adapter returns the raw input value; `runInterview` owns keep-prefill-vs-clear (`opentui-prompter.ts`) |
| code MED | Banner rendered twice + pre-TUI logs wiped by opentui's alt-screen | TTY path prints only after teardown; banner lives in the TUI (`index.ts`) |
| sec LOW | PII DB/dir created world-readable | `mkdir` `0o700` + `chmod` `0o600` on the DB file (`db.ts`) |
| sec LOW · code | Top-level catch could echo a future PII-bearing error to stderr | Generic message + `DEBUG`-gated detail (`index.ts`) |
| sec INFO | `fullName`/`taxId` unbounded | `.max(200)` / `.max(64)` (`profile.ts`) |
| code LOW | `"me"` default id duplicated | `DEFAULT_PROFILE_ID` shared by schema + repo |
| code LOW | `answersToProfile` trimmed only optionals | Trims required fields too |
| code LOW | `ensure()` vague name | → `ensureRenderer()` |

Post-fix gate: **25 tests pass · 100% stmts/funcs/lines, 96.15% branches · tsc + biome clean.**

### 🟡/🟢 Findings — deferred (rationale in `98-nice-to-haves.md`)
- **perf MED** — `db.prepare()` per call + implicit per-row transactions — ✅ PAID in epic B
  (`ingest-repo.ts` factory; verified by the B-panel perf seat).
- **perf MED/LOW** — `synchronous=NORMAL` + `busy_timeout` + migrations step — ✅ PAID in epic B
  (`db.ts`, `migrations.ts`).
- **code LOW / sec LOW** — `loadProfile` throws on corrupt/legacy stored JSON: decide recovery
  (re-interview vs migrate) before the schema evolves.
- **code LOW** — non-TTY guard branch has no unit test (excluded by design); accepted.
- **sec INFO** — SQLite unencrypted at rest: rely on full-disk encryption or adopt SQLCipher for a
  device-theft threat model; record in an ADR with the `es` slice.
