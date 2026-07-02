# B5 — `scan` orchestration + cron wiring  (per-task spec)

- Task id: B5
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
Assemble the tested seams into the daily headless run: `tax-agent scan` (agent call → parse →
verify → files → SQLite, idempotent) and the system-cron wiring that runs it every morning.

## Scope / non-goals
**In scope**
- `src/ingest/scan.ts` — `runScan(deps: {db, agent: AgentRunner, downloadsRoot, log, now})`:
  preflights (profile exists · CLI binary resolvable, else exit-1 hints: "run the interview
  first" / "configure a Gmail MCP for codex or use TAX_AGENT_LLM=claude") · watermark =
  `latestEmailDate() ?? Jan 1 of profile.taxYear` minus 2-day overlap · agent call with
  `buildScanPrompt`, single retry via `buildRetryPrompt` on parse failure · `hasMore` loop ·
  per-bill try/catch (one bad item never kills the run) · dedupe `hasEmail` · verify → write .md →
  insert row (one transaction per email) · returns `ScanSummary {emailsSeen, billsExtracted,
  attachmentPending, notBills, failures}`.
- `src/cli/scan.ts` — fill the B0 stub: wire real deps, map summary → exit codes
  (0 clean · 2 completed-with-failures · 1 fatal).
- **No PII in logs**: counts, gmail message ids, row ids, reason codes, durations. Never subjects,
  vendors, amounts, prompts, quotes.
- `scripts/cron-scan.sh` — PATH pins (nvm node bin = `claude`; `~/.bun/bin` = codex;
  `/opt/homebrew/bin`), cd repo, `exec node node_modules/tsx/dist/cli.mjs src/index.ts scan`.
- README section: the crontab line (human installs — we never modify the user's crontab)
  `15 8 * * * /bin/sh <repo>/scripts/cron-scan.sh >> <repo>/data/logs/cron.log 2>&1`,
  log location `data/logs/` (gitignored, 0700), macOS **Full Disk Access grant for
  `/usr/sbin/cron`** (TCC on `~/Downloads`) + `data/bills/` fallback.

**Non-goals** — no report/TUI (B6), no crontab modification by agents.

## Acceptance criteria
- [ ] 1. Fake-driven run (fake AgentRunner scripted: 2 bills + 1 not-bill + 1 attachment-only):
      summary counts correct, rows in `:memory:` DB, .md files in tmpdir with right paths/perms.
- [ ] 2. Idempotency: second identical run → 0 new rows/files (gmail id dedupe) (unit test).
- [ ] 3. Retry path: invalid-then-valid scripted replies → succeeds with 1 retry; twice-invalid →
      `failures` counted, exit code 2 mapping (unit tests).
- [ ] 4. Log lines contain no vendor/subject/amount strings (assertion over captured log output).
- [ ] 5. `scripts/cron-scan.sh` runs from a bare env (`env -i /bin/sh scripts/cron-scan.sh`
      smoke, pasted) — proves PATH pins.
- [ ] 6. Gates green: `tsc` · `biome` · coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/ingest/scan.ts`(+test) · `src/cli/scan.ts` · `scripts/cron-scan.sh` · `README.md`.
Consumes B1 repo, B2 adapter (via `AgentRunner`), B3 prompt/verify/files.

## Risks & assumptions
- Live-inbox + cron-context verification (FDA grant) happens in B7's E2E with the user present.
