# 99 — Acceptance & traceability

Legend: ✅ done & tested (evidence pasted) · ⚠️ done with a documented limitation ·
🔧 stubbed/mocked · ❌ not done · 🚫 blocked · ⬜ future task.

---

# P1 — Pipeline V2 (2026-08-02)

Evidence graph per `.ai/references/evidence-graph.md`: `requirement → behavior → implementation →
test → passing output`. **A row is ✅ only with pasted proof.**

## Gate output (run 2026-08-02, all from the repo root)

```
$ sh -n scripts/sync-ai-docs.sh                       # exit 0
$ sh scripts/sync-ai-docs.sh
  docs → AGENTS.md, CLAUDE.md, GEMINI.md, .ai/generated/rules.mdc (+ .cursor symlink)
  commands→ 15 × {.claude, .opencode (md), .gemini (toml)}
  agents  → 6 × {.claude, .opencode, .gemini}
  skills  → 31 × {.claude/skills, .gemini/skills}
$ shasum AGENTS.md   (after run 1 and run 2)          # IDENTICAL
$ node scripts/validate-task-graph.test.mjs           # 74 passed, 0 failed
$ node scripts/validate-task-graph.mjs .ai/specs/task-graphs/P1.json
  ✓ 16 nodes, no cycles, all nodes explained and checkable
$ node scripts/validate-task-graph.mjs --reconcile .ai/specs/task-graphs/P1.json
  scope: whole graph · 46 changed file(s) (working tree)
  ✓ no unexplained scope — every changed file is in a declared write_set
$ pnpm exec tsc --noEmit                              # exit 0, no output
$ pnpm exec biome check                               # Checked 54 files. No fixes applied.
$ pnpm test                                           # Test Files 16 passed (16)
                                                      # Tests 190 passed | 1 skipped (191)
                                                      # Statements 98.33% Branches 90.03%
$ git diff --name-status -- src/                      # (empty)
$ git diff --check                                    # (empty)
```

## Requirement matrix

| # | Requirement | Behavior | Implementation | Test | Evidence | Status |
|---|---|---|---|---|---|---|
| AC1 | sync script syntax valid | `sh -n` exits 0 | `scripts/sync-ai-docs.sh` | shell parse | `exit=0` above | ✅ |
| AC2 | sync is idempotent | 2nd run adds no change | `sync-ai-docs.sh:30-31` deterministic | two runs + `shasum` | `IDENTICAL` above | ✅ |
| AC3 | generated contract reflects sources | `AGENTS.md` inlines context+pipeline; CLAUDE/GEMINI stay stubs | `sync-ai-docs.sh:104-107` | `git diff --exit-code` after sync | `377 insertions(+), 133 deletions(-)`; 3rd sync → exit 0 | ✅ |
| AC4 | validator detects cycle / evidence-free VERIFIED / write-set overlap | non-zero exit on each | `validate-task-graph.mjs` | `validate-task-graph.test.mjs` | `74 passed, 0 failed` | ✅ |
| AC5 | P1 graph valid | no cycles, all nodes explained + checkable | `.ai/specs/task-graphs/P1.json` | validator default mode | `✓ 16 nodes…` | ✅ |
| AC6 | no unexplained scope | every changed file in a declared `write_set` | `reconcile()` | `--reconcile` | `✓ no unexplained scope` (46 files) | ✅ |
| AC7 | Legacy CLI stays green | tests/typecheck/lint pass | `src/**` untouched | `pnpm test`, `tsc`, `biome` | `190 passed`; 98.33% stmts | ✅ |
| AC8 | no product code created | `src/` diff empty | — | `git diff --name-status -- src/` | (empty) | ✅ |
| AC9 | no unresolved placeholder | only legitimate template docs mention them | `.ai/memory.example.md:1` fixed | placeholder grep | 1 hit: `scripts/install.sh:2` comment (accurate) + README attribution line | ✅ |
| AC10 | every skill/persona/reference reference resolves | each `agent-skills:` maps to a real SKILL.md | `.ai/commands/**` | resolution sweep | 10/10 skills ✓, 6/6 personas ✓, 3/3 new references ✓ | ✅ |
| AC11 | fan-out ownership unambiguous | one command owns it | `consensus-review.md`, `ship.md`, `agents/README.md`, `orchestration-patterns.md` | greps | `fan-out orchestrator` in ship.md → **0**; `ONLY reviewer fan-out` → **1** | ✅ |
| AC12 | blocking pre-commit test gate exists | fails the commit on test failure | `.githooks/pre-commit.d/20-test.sh` | `sh -n`, `-x`, and a **deliberate threshold break** | `ERROR: Coverage for branches (90.03%) does not meet global threshold (99%)` — gate observed failing, then reverted | ✅ |
| AC13 | tree clean, commits local only | no push | — | `git diff --check`, `git status`, `git log` | see "Commits" below | ✅ |
| AC14 | acceptance carries a complete evidence path | this document | `.ai/specs/99-acceptance.md` | self | this matrix + the two lists below | ✅ |
| AC15 | PII scratch paths ignored (**containment, not prevention**) | ordinary `git add` cannot stage them | `.gitignore:19,25` | `git check-ignore`, `git ls-files` | `.gitignore:25:tmp/ → tmp/pdfs/renta-pago.txt`; `git ls-files -- data tmp` empty | ⚠️ |
| AC16 | `pnpm test` green with the standalone self-test present | vitest scoped to `src/` | `vitest.config.ts:8-11` | `pnpm test` | `Test Files 16 passed (16)` | ✅ |

**AC15 is ⚠️, not ✅, deliberately.** `git add -f` still stages an ignored file, and PII under an
unlisted name is unaffected. The claim is containment; a fail-closed staged-content gate is deferred.

## Invariant rows

| Invariant | Proving check | Result |
|---|---|---|
| Generated files change only via `.ai/` | `sync && git diff --exit-code -- AGENTS.md CLAUDE.md GEMINI.md` | exit 0 ✅ |
| Task graph acyclic + resolved | validator | ✅ |
| No `VERIFIED` node without evidence | test "VERIFIED without evidence is rejected" | ✅ |
| Evidence entries are real | tests H1/H1b/H1c — `null`, command-without-output, and no-command-no-file_ref all rejected | ✅ |
| Cited `AC<n>` exists in the spec | test "a cited AC that the spec does not define is rejected" | ✅ |
| `parallel_safe` never authored | validator rejects non-null | ✅ |
| No state skipping | test "VERIFIED with a non-VERIFIED dependency is rejected" | ✅ |
| Legacy v0 green and untouched | `pnpm test` + `git diff -- src/` | ✅ |
| Contract claims no gate it cannot enforce | hardness audit; DoD reworded for `src/` scoping; `/reconcile`-not-automated stated | ✅ |
| Mirrors never become tracked | `.githooks/pre-commit:40-46` | ✅ (unchanged) |

## Other required rows

| Row | Evidence | Status |
|---|---|---|
| **Graph delta** (planned vs actual) | `--reconcile`: 46 changed, 0 unexplained; 4 declared-but-untouched, all explained (`03-review.md`, `99-acceptance.md` written last; `CLAUDE.md`/`GEMINI.md` regenerated identical) | ✅ |
| **Loop transitions** | 15 nodes `VERIFIED` with evidence; N16 `VERIFIED` on this commit. Failure states now written before returning to `IMPLEMENTING` | ✅ |
| **Security boundary** | codex audit: no Critical; H1/H2/M1/M3/M4/M6 fixed; gitleaks clean over tracked diff + 20 untracked files; `execFileSync` no shell; `--base` argv injection blocked (live probe created no file) | ✅ |
| **Tenancy boundary** | n/a — P1 touches no tenant-scoped data. Stated in `P1-spec.md`, not assumed | ✅ |
| **Documentation** | README rewritten (H1 was `# cross-ai-template`); 4 ADRs; 3 references | ✅ |
| **Generated-contract sync** | 3 syncs, byte-identical, `git diff --exit-code` 0 | ✅ |

## Honest Implementation Metric

**15 ✅ + 1 ⚠️ of 16 criteria = 93.75% verified.**
Not rounded up. AC15 is ⚠️ because the honest claim is weaker than the original wording.

## Unverified

- **The resume claim.** `.ai/references/loop-state-machines.md` says a fresh clone can resume from
  the committed graph. Until this commit lands, the files were untracked, so it was *false at the
  time the loop reviewer checked it*. After this commit it should hold, but **it has not been tested
  by an actual fresh `git clone`** — that is the only honest test and it was not run.
- **Herdr recipes for client 0.7.1** are recorded in `.ai/memory.md` from one working session; they
  were not re-tested after the pane was closed.
- **`readSpecCriteria` parsing** is validated against `P1-spec.md`'s shape only. A spec using a
  different checkbox style would silently yield `null` and skip the AC-resolution check.

## Could-not-do

- **No CI exists**, so nothing enforces these gates on a shared branch. The pre-commit hooks are
  per-clone opt-in (`git config core.hooksPath .githooks`). Recorded in `98-nice-to-haves.md`.
- **The pre-commit gate could not be proven to block a real commit** — doing so would require making
  a deliberately failing commit. It was proven to *fail* via the coverage-threshold break, which is
  the same code path, but the end-to-end "commit is refused" was not executed.
- **M5 (`10-biome.sh` argument injection) was not fixed** — pre-existing and outside every P1 node's
  write set; fixing it would have been unexplained scope. Recorded with the fix.
- **PostgreSQL 18/19 compatibility was not exercised** — no database exists yet. ADR 0004 records
  the posture only.

## Bootstrap exceptions (Pipeline V2 did NOT govern its own creation)

1. The proposal preceding this work was produced under the **previous** contract.
2. `P1-spec.md` and `P1.json` were authored under the previous contract; the graph carries
   `bootstrap_exception: true`.
3. `/map` ran as a manual inline inspection, not as the V2 command (which did not exist).
4. The four ADRs describing V2 are not themselves V2-governed artifacts.
5. **Commits are task-level, not per-node.** The node loop requires one atomic commit per `VERIFIED`
   node; P1's nodes were authored in one pass before that rule was committed. From P2 onward,
   per-node commits apply.

## Pending human ratification

Amendments **A1** (`.gitignore`) and **A2** (`vitest.config.ts`) — see `P1-spec.md` → Amendments.
An agent may not approve its own scope change.

## Verdict

**GOAL MET for P0**, with AC15 honestly at ⚠️ and two amendments awaiting ratification.
Product implementation has not started.

---

> Scope: tasks **A1** (foundation) + **epic B** (B0–B7: daily Gmail billing scan via subscription
> agent-CLI → bills to `~/Downloads/tax-agent/YYYY-MM/` → Spain table in TUI).
> Legend: ✅ done & tested (evidence pasted/referenced) · ⚠️ done with a documented limitation ·
> 🚫 blocked on the user · ❌ not done · ⬜ future task.

## Epic B — gate evidence (2026-07-02, post-consensus-fixes)
- `pnpm test` → **190 passed, 1 skipped (16 files)** (the skip is the opt-in live `claude -p`
  smoke, run once manually: PONG ✅).
- coverage (v8, gate ≥ 80%) → **98.33% stmts · 90.03% branches · 96.47% funcs · 98.78% lines**
  (CLI command shells + opentui views excluded by design — TTY/process-bound).
- `pnpm exec tsc --noEmit` → **clean** · `pnpm exec biome check` → **clean (51 files)**.
- **Live E2E (isolated env, real Gmail, real `claude -p`):**
  - Headless connector proof: `claude -p` + Gmail search tool → `FOUND 201`.
  - `scan`: `emailsSeen=8 billsExtracted=2 attachmentPending=0 notBills=6 failures=0` exit 0
    (243s), PII-free log lines; 2 real bills stored `verified=1`.
  - Files: `2026-07/taxfix-2026-07-01.md`, `2026-07/glovo-la-capricciosa-italiana-2026-07-01.md`
    — dirs `drwx------`, files `-rw-------`.
  - `report --month 2026-07` (piped): real table — Taxfix 120,88 € (IVA 20,98 €), Glovo (meals)
    58,00 € → Total EUR 178,88 €; es block with [LIVA-90.Uno]/[LIVA-95]/[LIRPF-30]/[AEAT-M303/130]
    citations; meals correctly non-deductible (deducible = 20,98 €, only Taxfix).
- Consensus panel: **3/3 APPROVE** — security · performance · code (initial REQUEST_CHANGES with
  1 CRITICAL + 2 MED + LOWs, all applied same pass and independently re-verified by the reviewer;
  see `03-review.md`).

## Epic B acceptance — per task (aggregating each Honest Implementation Report)
| Task | Metric | Evidence highlights | Open items |
|---|---|---|---|
| B0 router | 4/4 = 100% | 36 tests; stub/regression runs pasted in-session | — |
| B1 domain+storage | 5/5 = 100% | 75 tests; real legacy DB adopted to `user_version=2` | — |
| B2 agent-CLI | 5/5 = 100% | fake-exec argv matrix; real `claude -p` smoke PONG | — |
| B3 scan-task+verify+files | 6/6 = 100% | 33 tests; fabricated-total reject; es/en amount normalization | — |
| B4 es module | 5/5 = 100% | 24 tests; golden numbers; whole-report traceability sweep | `DEDUCTIBLE_SHARE` legal review (user/asesor) |
| B5 scan+cron | 5/6 ≈ 83% | 48 ingest tests; bare-env cron-script smoke (PATH pins proven) | 🚫 real cron firing + FDA grant need the user |
| B6 report+TUI | 4/5 = 80% | golden renders; real-CLI piped table | 🚫 TTY `q`-exit needs a human terminal |
| B7 integration | see below | gates + live E2E above; panel fixes applied | 🚫 user-side steps below |

## Project requirements (00-requirements) — coverage by task
| Requirement | Status | Covered by |
|---|---|---|
| opentui interview for profile + local persistence | ✅ (A1; TTY run user-confirmed limitation) | A1 |
| Daily cron: scan bills, extract + classify | ✅ code+tests+live scan · 🚫 crontab install is the user's | B2/B3/B5 |
| Country-correct tax/billing report (Spain first, per-country module) | ✅ | B4/B6 |
| Every figure traces to a source document or cited rule | ✅ structural (`figure()` throws on no source; verify gate; provenance chain bill→email→file) | B1/B3/B4 |
| LLM-agnostic (local claude/codex CLIs, no API keys) | ✅ claude live-proven; ⚠️ codex argv-tested only (needs a user-side Gmail MCP for codex) | B2 |
| Local RAG / vector DB store (sqlite-vec) | ⬜ deferred with rationale (`98-nice-to-haves.md`) | — |

## Unverified (asserted but not proven here)
- codex end-to-end scan (adapter argv-tested + sandboxed; no codex Gmail MCP configured to test).
- Cron-context write to `~/Downloads/tax-agent` (macOS FDA grant) — needs the user's one-time grant
  and a real cron firing.
- opentui table view interactive exit (`q`) — needs a human terminal.
- `DEDUCTIBLE_SHARE` legal accuracy — conservative defaults, flagged for asesor review.

## Could-not-do (environment limits)
- Install the crontab line (hard rule: agents never modify the user's crontab).
- Grant Full Disk Access to `/usr/sbin/cron` (macOS Settings UI, user-only).
- Run the interview against the real DB (TTY) — the real `data/tax-agent.sqlite` has NO profile
  row yet; the live E2E used an isolated seeded DB (`self_employed`, labeled test-only).

## Verdict
**Epic B GOAL MET for everything verifiable in this environment** — full pipeline proven live
(real Gmail → real bills → verified figures → cited Spain table), 190 tests green, coverage ≥ 90%
branches, 2-of-3 panel approval with the code seat's CRITICAL fixed and regression-tested in the
same pass. Remaining items are user-side by nature: run the interview once, install the crontab
line, grant FDA (or set `TAX_AGENT_DOWNLOADS_DIR`), press `q` in the TUI once.

---

# A1 acceptance (2026-07-01) — unchanged

**Gate evidence:** `pnpm test` → 25 passed · coverage 100/96.15/100/100 · `tsc` clean · `biome`
clean (18 files).

| # | Criterion | Implementation | Test | Status |
|---|---|---|---|---|
| 1 | CLI launches interview → writes profile row to local SQLite | `src/cli/interview.ts` (was `src/index.ts` `main`), `src/storage/profile-repo.ts` `saveProfile` | `profile-repo.test.ts` round-trip + on-disk reopen | ⚠️ persistence verified; live opentui launch needs a TTY — run `pnpm dev` |
| 2 | Every input validated with zod; invalid rejected | `src/domain/profile.ts` `parseProfile`, `src/interview/interview.ts` `validateAnswer` | `profile.test.ts` + `interview.test.ts` | ✅ |
| 3 | Re-launch loads existing profile for review/edit | `profile-repo.ts` `loadProfile`, `interview.ts` `prefillFor` | prefill + optional-clear tests | ✅ |
| 4 | Persistence + schema unit tests, coverage ≥ 80% | `src/{domain,interview,storage}/**` | 25 tests, 100% lines/funcs | ✅ |
| 5 | `tsc` + `biome` + `pnpm test` green | project config | gate evidence | ✅ |

**Honest Implementation Metric (A1): 4/5 = 80%** — AC#1 ⚠️ (interactive TUI launch not runnable
in a headless env).
