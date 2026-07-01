# 03 — Consensus review (project finish)

- Scope: task **A1** — opentui profile interview + local persistence
- Panel: `code-reviewer` · `security-auditor` · `performance-reviewer` (parallel sub-agents)
- Gate: 2-of-3 APPROVE → **met unanimously (3/3 APPROVE)**
- Traces to: [`A1-spec.md`](./A1-spec.md) · fixes tracked in [`98-nice-to-haves.md`](./98-nice-to-haves.md)

## 🔵 Verdict
**APPROVE.** Foundation slice is clean and well-factored: the zod boundary → pure `answersToProfile`
→ SQLite split makes the untestable TTY layer genuinely thin, every acceptance criterion is
covered, and the no-PII-in-logs / parameterized-SQL constraints hold. No CRITICAL/HIGH/MEDIUM
security or performance blockers. One HIGH usability finding (validate-at-end discarded all answers)
was fixed in this pass, not deferred.

## ⚫/⚪ Findings — applied this pass
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

## 🟡/🟢 Findings — deferred (rationale in `98-nice-to-haves.md`)
- **perf MED** — `db.prepare()` per call + implicit per-row transactions: negligible at 1 profile
  row; **must** hoist prepared statements + wrap in `db.transaction()` before the document/embedding
  ingestion loop lands. Not refactored now (YAGNI).
- **perf MED/LOW** — add `PRAGMA synchronous = NORMAL` + `busy_timeout` when the cron writer can
  contend with the TUI; move DDL into a migrations step when the documents/`sqlite-vec` tables land.
- **code LOW / sec LOW** — `loadProfile` throws on corrupt/legacy stored JSON: decide recovery
  (re-interview vs migrate) before the schema evolves.
- **code LOW** — non-TTY guard branch has no unit test (excluded by design); accepted.
- **sec INFO** — SQLite unencrypted at rest: rely on full-disk encryption or adopt SQLCipher for a
  device-theft threat model; record in an ADR with the `es` slice.
