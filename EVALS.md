# EVALS — feature evaluation catalogue

Hand-edited (like `README.md`). The runner is `pnpm eval` → `scripts/run-evals.mjs`.
Results are written to `.ai/specs/95-eval-results.md` by `/eval`.

## The four-surface rule

**Every eval must ACCOUNT FOR all four surfaces. Not every eval can assert all four.**

| Surface | What it means here | Legacy v0 | Platform |
|---|---|---|---|
| **UI** | what a human sees | opentui TUI (`src/tui/`) | Next.js RSC page |
| **LOG** | the backend log line | `console.log` via the `ScanLog` sink (`src/cli/scan.ts:34`), `data/logs/cron.log` | OpenTelemetry + structured logs |
| **DB** | rows actually written | SQLite `data/tax-agent.sqlite` — `profile`, `emails`, `bills` | PostgreSQL |
| **OUT** | the returned artifact | stdout string / written `.md` file / exit code | API response |

Each surface is recorded as one of:

- **`assert`** — a real check with pasted output. The only state that counts as evidence.
- **`n/a: <reason>`** — the surface genuinely does not exist for this feature (e.g. `scan` is
  headless, so it has no UI). A reason is mandatory.
- **`blocked: <reason>`** — the surface exists but cannot be checked here (e.g. the TUI needs a pty).
- **`not-implemented`** — platform features. The eval is a specification, not a result.

> **Why "account for" and not "assert all four".** A literal all-four-assertions rule would force a
> fabricated UI assertion for a headless command. Under this repo's honesty protocol that is worse
> than an honest `n/a`. The rule is that a surface may never be *silently omitted* — every eval
> renders all four columns, and an unfilled one fails the eval.

## Status legend

✅ pass · ❌ fail · ⚠️ partial (some surfaces blocked) · 🚫 blocked · ⬜ not-implemented (specified only)

---

## Feature table

### Legacy CLI v0 — implemented, frozen (`src/**`)

| ID | Feature | Input | Output | Expected |
|---|---|---|---|---|
| **L1** | Profile interview | User answers (country, residency, tax year, filing situation, optional NIF) via the opentui prompter | One row in `profile` (`id`, `data` JSON, `updated_at`) | Valid answers → a parsed `Profile` persisted and re-loadable; invalid (bad country, missing tax year) → Zod error with a clear message, **nothing written** |
| **L2** | Bill scan (idempotent) | Agent-CLI JSON reply (`AgentScanReportSchema`) + a date watermark | One `.md` per bill under the downloads root; `emails` + `bills` rows | Each bill verified and stored once; re-running the same input adds **no** new rows (`gmail_message_id UNIQUE`); exit 0 clean / 2 partial / 1 fatal |
| **L3** | Never-fabricate gate | A bill whose `totalCents` does **not** appear in the source text, or where Σbase+Σvat ≠ total (>±1c/line) | Rejection | Bill **not** stored; an `emails` row with `status='failed'` and a reason code; no `.md` written |
| **L4** | Month report | `--month YYYY-MM` | A rendered month table (per-bill rows + Spain summary) | Every figure integer cents with a traceable source; identical string on a TTY (in the TUI) and piped to stdout |
| **L5** | Spain (`es`) rules module | `BillRecord[]` + profile + month | `CountryReport { figures: TraceableFigure[], notes }` | Every figure carries non-empty `ruleIds`/`billIds`; constructing one without sources **throws** |
| **L6** | Cron wrapper | Bare cron environment (`HOME` set, minimal `PATH`) | Exit code + appended `data/logs/cron.log` | Correct node pinned (matches `better-sqlite3` NMV); log contains counts/ids/reason codes and **no** vendor, subject, or amount |
| **L7** | CLI router | `argv` | Dispatch to `interview` / `scan` / `report` / `help` | Unknown or malformed args → usage on stderr + exit 2; `--month` validated by `MonthSchema` |

### Platform — specified, **not implemented**

These are the acceptance shape for Phase 1+. They are **not runnable** and must never be reported
as passing.

| ID | Feature | Input | Output | Expected |
|---|---|---|---|---|
| **P1** | Ledger fact ingest | A financial fact (amount minor units, currency, source doc id, tenant) | Append-only ledger row | Fact never mutated or lost; a correction is a **new** fact; provenance resolvable |
| **P2** | Budget / monthly cash flow | Household id + period | Cash-flow projection | Every value tagged actual/planned/forecast; integer minor units; explicit currency |
| **P3** | Tax reserve loop (closed) | Income facts + jurisdiction rule | Recommendation → human approval → observed outcome → reconciled difference | The difference feeds the next period's assumption; **no** LLM arithmetic; system may stage, never execute |
| **P4** | Debt plan | Liabilities + strategy | Ordered payoff schedule | Deterministic; reproducible from frozen inputs |
| **P5** | Goal dependencies | Goal id | Blockers and enablers with provenance | Each edge cites a rule id or fact id; explanation path fully citable |
| **P6** | Mortgage readiness | Household position | Readiness verdict + blocking reasons | Deposit read from the **ledger**, never stored on a graph edge |
| **P7** | Multi-currency | Accounts in several currencies | Aggregated position | Currency explicit on every value; no cross-currency sum without a stated rate + date |
| **P8** | Fiat + crypto assets | Holdings | Valued position | **A stablecoin is never presented as equivalent to a protected bank deposit** |
| **P9** | Document ingestion | PDF / image / email | Stored doc + extracted facts | Every extracted fact carries a document id; nothing extracted without provenance |
| **P10** | Hybrid retrieval | Query | Ranked evidence (RRF over lexical + pgvector) | Lexical implementation named accurately (**not** "BM25" unless it is); **never** answers a balance |
| **P11** | Domain graph explanation | Entity id | Explanation path | Every hop citable; balances read from the ledger at query time |
| **P12** | Auditable recommendation | Scenario (immutable inputs) | Recommendation + evidence + assumptions | Re-running identical inputs reproduces it byte-for-byte |
| **P13** | Tenant isolation | Household B requesting household A's rows | Refusal | **Negative** assertion: zero rows, explicit authorization filter in the query |
| **P14** | No-LLM-arithmetic guard | A money computation path | Computed figure | Produced by code, never by a model; no floating-point anywhere |

---

## Eval definitions

Each eval below names its four surfaces. `pnpm eval` runs the runnable ones and reports the rest as
blocked or not-implemented — it never reports them as passing.

### L1 — Profile interview

| Surface | Check |
|---|---|
| UI | `blocked: opentui needs a real TTY/pty; the render layer is proven by manual `pnpm dev`. Pure `answersToProfile` is unit-tested instead.` |
| LOG | `assert:` no PII in output — the run emits no `taxId`/name |
| DB | `assert:` exactly one `profile` row; round-trips equal; invalid input writes **zero** rows |
| OUT | `assert:` `parseProfile` returns a `Profile`; invalid → Zod error message |

### L2 — Bill scan idempotency

| Surface | Check |
|---|---|
| UI | `n/a: scan is headless (cron-invoked); it has no interactive surface.` |
| LOG | `assert:` log lines contain counts + message ids + reason codes and **no** vendor/subject/amount |
| DB | `assert:` first run inserts N `bills`; second run with identical input inserts 0 |
| OUT | `assert:` one `.md` per bill; exit code 0 |

### L3 — Never-fabricate gate

| Surface | Check |
|---|---|
| UI | `n/a: headless.` |
| LOG | `assert:` a reason code is logged for the rejection |
| DB | `assert:` zero `bills` rows; one `emails` row with `status='failed'` |
| OUT | `assert:` no `.md` file written for the rejected bill |

### L4 — Month report

| Surface | Check |
|---|---|
| UI | `blocked: the TUI table view needs a TTY; the rendered string is identical on both paths, so OUT covers the content.` |
| LOG | `n/a: report is a pure read; it logs nothing by design.` |
| DB | `assert:` reads the `bills` rows it renders (row count matches table rows) |
| OUT | `assert:` golden string match; every amount integer cents |

### L5 — Spain rules traceability

| Surface | Check |
|---|---|
| UI | `n/a: pure module.` |
| LOG | `n/a: pure module.` |
| DB | `n/a: operates on already-loaded records.` |
| OUT | `assert:` every `TraceableFigure` has non-empty sources; constructing one without sources **throws** |

### L6 — Cron wrapper

| Surface | Check |
|---|---|
| UI | `n/a: headless.` |
| LOG | `assert:` `data/logs/cron.log` gains lines with no PII |
| DB | `assert:` unchanged when the scan is a no-op |
| OUT | `assert:` exit code propagates |

> **Status: 🚫 blocked** — requires the user's real crontab and a live agent CLI. Documented in
> `.ai/specs/98-nice-to-haves.md`; not runnable in CI or by an agent.

### L7 — CLI router

| Surface | Check |
|---|---|
| UI | `n/a: argv parsing.` |
| LOG | `assert:` usage goes to **stderr**, not stdout |
| DB | `n/a: no persistence.` |
| OUT | `assert:` exit 2 on bad args; correct command kind on good args |

### P1–P14 — platform

All four surfaces: `not-implemented`. Each becomes runnable in the phase that builds it
(see the README roadmap). **`/eval` reports these as ⬜ and they never count toward a pass rate.**

---

## Running

```sh
pnpm eval            # run the runnable evals, print the four-surface matrix
pnpm eval --json     # machine-readable, for /eval to embed in its report
```

Exit codes: `0` all runnable evals pass · `1` a runnable eval failed · `2` usage.
Blocked and not-implemented evals **never** cause a non-zero exit — they are reported, not hidden.

## Integration with the pipeline

- **`/eval` (stage 7b)** runs this catalogue and writes `.ai/specs/95-eval-results.md`.
- **Definition of Done** (`.ai/context.md`) requires the runnable evals green.
- **`/acceptance`** pulls each eval's four-surface row into the evidence graph.
- **A new feature is not done until it has an eval row here** with all four surfaces accounted for.
