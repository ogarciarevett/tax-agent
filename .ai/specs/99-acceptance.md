# 99 — Acceptance & traceability

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
- Consensus panel: security **APPROVE** · performance **APPROVE** · code **REQUEST_CHANGES → all
  findings (1 CRITICAL, 2 MED, LOWs) applied same pass** (see `03-review.md`), re-verdict requested.

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
