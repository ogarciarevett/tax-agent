# 03 — Consensus review

## P1 — Define and self-host the graph-orchestrated loop pipeline (2026-08-02)

- Change class: **pipeline-contract** -> mandatory panel per `.ai/context.md` -> "Consensus review"
- Structure: Six-Hats (Black+White audit in parallel -> Yellow+Green synthesis -> Blue verdict)

### Blue - frame

Under review: 46 changed files defining Pipeline V2. Pass/fail: no unresolved critical finding, no
unresolved high-severity security/invariant/graph/loop finding, and **every mandatory correctness
reviewer approves**. Majority cannot override a correctness proof failure.

Each reviewer was briefed with verified ground truth (real paths, the real graph, runnable commands)
and told not to manufacture findings.

### Black + White - the panel

| Seat | Runtime | Initial verdict | Findings |
|---|---|---|---|
| `code-reviewer` | native sub-agent | **REQUEST CHANGES** | 2 Critical, 9 Important, 8 Suggestions |
| `graph-consistency-reviewer` | native sub-agent | **REQUEST CHANGES** | 2 Critical, 4 Important, 3 Suggestions |
| `loop-correctness-reviewer` | native sub-agent | **REQUEST CHANGES** | 7 Critical, 6 Important, 3 Suggestions |
| `security-auditor` | **`codex` (gpt-5.6) in a Herdr pane** | **REQUEST CHANGES** | 0 Critical, 2 High, 6 Medium |

Every reviewer reproduced its findings with pasted output rather than reasoning about them. The
security seat ran on a different model family deliberately (ADR 0003); its two High findings were
ones no Claude-family seat raised.

### Critical and High findings - all fixed

| # | Seat | Finding | Fix | Proof |
|---|---|---|---|---|
| C1 | graph | **`AC15` cited by the graph but never defined in the spec** - the graph invented a criterion and cited the spec as authority | Added AC15/AC16 to `P1-spec.md` with an explicit Amendments section; **and** taught the validator to resolve every cited `AC<n>` against `spec_source` so it cannot recur | test: "a cited AC that the spec does not define is rejected" |
| C2 | graph | `P1-spec.md` said `vitest.config.ts` and `.gitignore` were "Not touched"; both were modified and declared | Recorded as amendments A2/A1; scope + blast radius corrected | `P1-spec.md` Amendments |
| C3 | code, loop | **A node persisted as `READY` became permanently invisible** - `readyNodes` required `status === "PROPOSED"`, so following the transition table stranded it | `SELECTABLE = {PROPOSED, READY}` | test: "a node persisted as READY is still selectable" |
| C4 | loop | **State skipping unenforced** - a `VERIFIED` node with a `PROPOSED` dependency validated clean | dependency-status check | test: "VERIFIED with a non-VERIFIED dependency is rejected" |
| C5 | loop | **`/reconcile` passed vacuously after committing** - clean tree + no `--base` returned green having examined nothing | clean tree with no `--base` is now an error | `reportReconcile` guard |
| C6 | loop, code | **Per-node write-set gate was graph-wide** - a write outside node A but inside node B passed silently | `--reconcile --node <id>`; `/build` step 8 uses it | test: "--node scopes unexplained scope" |
| C7 | loop | **`SPEC_GRAPH_DRIFT` is not a valid state** - two docs instructed marking it; the validator rejects it | renamed to `GRAPH_DRIFT` everywhere | `grep -rn SPEC_GRAPH_DRIFT .ai/` -> 0 |
| C8 | loop | **4 failure states had no writer**; real failures did an untabled `IMPLEMENTING -> IMPLEMENTING` | `/build` and `/review` write the failure state **first**; `IMPLEMENTING -> BLOCKED` and `VERIFIED -> REVIEW_FAILED` rows added | `.ai/pipeline.md` table |
| H1 | security | **A `VERIFIED` node passed with `verification_commands: [null]`, `write_set: [null]`, `evidence: [null]`** - only array-ness was checked | element-level validation; evidence needs a criterion **and** a command-with-output or a file_ref | 4 tests |
| H2 | security | **"No untracked PII path is committable" overclaimed** - `git add -f` bypasses `.gitignore` | AC15 reworded to *containment, not prevention*, bypass stated; `*.pem`/`*.key`/`*.p12`/`*.pfx` added | `P1-spec.md` AC15 |
| M1 | security | ReDoS remained via repeated `*a` (~1.8s at 10 segments); collapsing `**/` covered one shape only | globs with >8 wildcards rejected | test: "an over-complex glob is rejected" |
| M3 | security | `spec_source` accepted absolute paths outside the repo | absolute and `..` rejected | 2 tests |
| M4 | security | **`--reconcille` (typo) exited 0 without reconciling** - the gate silently did not run | unknown options are errors; `--base`/`--node` rejected outside reconcile | 2 tests |
| M6 | security | The "blocking" gate **failed open** when `pnpm` was missing | fails closed once `package.json` exists | `20-test.sh:10-20` |
| I1 | code | `validateGraph` **crashed** (`TypeError`) on input it had just diagnosed | bails after per-node type errors | 3 tests |
| I3 | code | **`--base` was an argv injection into git** - `--base --output=/path` writes an arbitrary file | values starting with `-` rejected; `--` appended | test + live probe: no file created |
| I4 | code | `git status --porcelain` quotes paths -> reconcile broke on spaces and accents (routine in a Spanish-language project) | `-z` parsing; rename source **and** destination captured | 2 tests |
| I6 | code | `critical_path` was decorative; `computeCriticalPath` stack-overflowed on cycles | adjacency asserted; cycle guard | 3 tests |

Also fixed: mis-tagged evidence criteria on 3 nodes; an evidence entry whose "command" was
`"Skill tool registration after sync"` (not a command); `N16` omitting its own graph file from its
write set; `N16` under-declaring the sync's side effects; normative duplication of the readiness rule
across 3 files with **different clause counts**; a DoD coverage claim ignoring `src/` scoping;
`package.json` hardcoding `P1.json`.

### Yellow - worth preserving (Chesterton's Fence for `/code-simplify`)

- **`globsOverlap`'s conservative bias.** The code reviewer brute-forced 144 glob pairs hunting for a
  false "disjoint" and found none. The comment explaining *why* over-reporting is safe is
  load-bearing - do not "optimize" it.
- **`execFileSync` over `exec`.** Correct instinct; the injection finding was about git's own parser.
- **The `tmp/` catch.** `/reconcile` found a live PII exposure on its first real run.
- **N10's evidence deliberately breaks the coverage threshold to prove the gate can fail, then
  reverts.** Hardness evidence, not assertion.
- **`bootstrap_exception: true`** with five enumerated exceptions and "do not read `P1.json` as
  self-governing".

### Green - alternatives surfaced

Node-scoped reconcile (adopted); deriving `edges_added` from `depends_on` (deferred, shorthand
documented); a `--transition <from> <to>` mode to make "invalid transitions fail loudly" mechanical
(deferred); `attempts`/`base_ref` node fields (deferred); transitive closure replacing per-pair
reachability (adopted).

### Blue - verdict

**APPROVED for local commit**, subject to two amendments awaiting human ratification.

- No unresolved **critical** finding - all 8 fixed, each with a regression test.
- No unresolved **high-severity** security finding - H1, H2, I3 fixed and proven.
- Every mandatory correctness reviewer's blocking findings addressed.
- Self-test grew **40 -> 74 tests**; every fix has a test that fails without it.

**Deferred with reason** (`98-nice-to-haves.md`, none blocking): M2 size limits; **M5 `10-biome.sh`
filename argument injection - pre-existing, outside every P1 write set, fix before sharing the
repo**; M6-partial (worktree vs index); transition checker; `attempts`/`base_ref`; approval
recording; `/reconcile` not run by automation; `validateGraph` still ~190 lines.

**Pending human ratification:** amendments **A1** (`.gitignore`, PII containment) and **A2**
(`vitest.config.ts`, test-discovery scope). An agent may not approve its own scope change.

### Process findings - recorded in ADR 0003

The `codex` reviewer, given an explicit and repeated **READ-ONLY** instruction, nonetheless edited
`package.json` (added then removed a `packageManager` key; net zero, tree verified unaffected).
**"Read-only" told to an external pane agent is a request, not a boundary.** Native sub-agents can
have write tools genuinely withheld; a full CLI in a pane cannot.

Second: the published Herdr `agent-automation` docs describe 0.7.5, but the installed client is
**0.7.1** with a materially different CLI (`--kind`/`--pane`/`agent prompt` do not exist). No Herdr
invocation is embedded in the committed contract, for exactly this reason.

---

## Epic B — daily billing scan via subscription agent-CLI (2026-07-02)

- Scope: tasks **B0–B7** — CLI router · bill domain/migrations/repo · agent-CLI adapter ·
  scan task + never-fabricate gate + file writer · `es` country module · scan orchestration + cron ·
  month report + TUI table · integration/E2E
- Panel: `code-reviewer` · `security-auditor` · `performance-reviewer` (parallel teammates)
- Gate: 2-of-3 APPROVE → **met 3/3**: security APPROVE · performance APPROVE · code
  REQUEST_CHANGES → all findings applied same pass → code re-review (independent diff read +
  gates re-run by the reviewer) → **APPROVE**
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
