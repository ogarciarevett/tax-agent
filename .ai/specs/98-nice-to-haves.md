# 98 — Nice-to-haves & deferred backlog

> **Template.** Out-of-scope items and the `/consensus-review` findings you chose not to fix
> now. Split into (A) applied this pass and (B) deferred with rationale. Append as you go —
> the `/test` and `/review` stages feed this. Delete this note once you start adding entries.

## A. Applied in the finish pass
- A1 `/test`: added on-disk DB round-trip test (was `:memory:`-only) + absent-optional prefill
  test → 100% coverage on domain/interview/storage; proved the suite bites via a `.int()` mutation.
- A1 `/consensus-review` (3/3 APPROVE): per-answer validation + re-ask loop (wired `note()`),
  optional-clear fix, banner/log restructure, DB file perms `0600`/`0700`, generic error handler,
  `.max()` bounds, `DEFAULT_PROFILE_ID` de-dup, `ensureRenderer()` rename. See `03-review.md`.

## B. Deferred (documented, not built)

### Test coverage
- **Live opentui TUI integration test** (`src/tui/opentui-prompter.ts`): drive the real interview
  through a pseudo-terminal (e.g. `node-pty`) — keystrokes → Enter → saved row. Deferred: needs a
  pty harness + a TTY in CI; the render layer is currently proven only by a manual `pnpm dev`. Cost: M.
- **NIF/NIE checksum tests**: real Spanish tax-ID validation belongs to the future `es` module;
  today `taxId` is just a non-empty string. Add alongside that module. Cost: S.

### Throughput / scale (revisit before the ingestion/cron slice)
- **Prepared-statement reuse + transactions**: `profile-repo` re-`prepare()`s per call and each
  bare `.run()` implicit-commits (fsync). Fine at 1 profile row; hoist statements to repo scope and
  wrap bulk inserts in `db.transaction()` before the document/embedding loop copies this shape.
  Micro-bench 10k prepared-in-txn vs prepare-per-row (expect >100×) to lock the convention. Cost: S.
- **WAL tuning**: add `PRAGMA synchronous = NORMAL` + a `busy_timeout` once the daily cron writer
  can contend with the TUI reader; move `CREATE TABLE` DDL into a migrations/init step when the
  documents + `sqlite-vec` tables land. Cost: S.

### Correctness / durability
- **Corrupt / legacy stored profile**: `loadProfile` re-validates and will throw on a malformed or
  schema-drifted `data` blob (`ZodError`/`SyntaxError`). Decide+test the recovery path (re-interview?
  migrate?) before the schema evolves. Cost: S.
- **SQLite at rest is unencrypted**: rely on full-disk encryption (FileVault) or adopt SQLCipher /
  `better-sqlite3-multiple-ciphers` if the threat model includes device theft. Record the decision
  in an ADR with the `es` slice. Cost: M.

### Functionality / ops
- ~~Bill/document ingestion + daily cron scan + Spain report generation~~ — ✅ shipped as epic B
  (B0–B7, 2026-07-02). Items below are what epic B deliberately deferred.

## Epic B deferred (2026-07-02)

- **Original PDF attachments**: the claude.ai Gmail connector has no attachment-download tool —
  bills land as extracted Markdown; attachment-only emails are flagged `adjunto pendiente de
  descarga manual`. Getting originals needs the Gmail API (user rejected) or browser automation.
  Cost: M.
- **Income ingestion**: without income data the es module can only emit expense-side estimates —
  a full Modelo 303/130 needs facturas emitidas / ingresos. Cost: L.
- **Independent verification pass**: sourceQuote/body come from the same agent session; a
  second-agent re-read (or original-document check) would harden the never-fabricate gate. Cost: M.
- **sqlite-vec / RAG embeddings**: not needed for scan/classify/report; add as a migration when
  semantic search over bills is wanted. Cost: M.
- **`TAX_AGENT_DB` path override**: report/scan open the default `data/` path relative to cwd;
  an env override would simplify isolated E2E runs (B6 used a temp cwd instead). Cost: S.
- **>20 billing threads in a single day**: the hasMore watermark advances by date with a
  no-progress guard + 20-batch cap; a single day with more than one batch of billing threads is
  a documented dedup-safe edge (some threads caught on the next daily run). Cost: S.
- **`DEDUCTIBLE_SHARE` legal review**: conservative defaults in `src/countries/es/rules.ts`
  (utilities/rent full share — prorrata may apply). Needs user/asesor sign-off. Cost: S.
- **launchd alternative to cron**: macOS-native scheduling would avoid the Full Disk Access
  grant UX for `/usr/sbin/cron`; contract currently locks system cron. Cost: S.
- **`TraceableFigure` has no currency field**: the es "Excluidas (moneda no EUR)" summary figure
  renders in € formatting although the label says non-EUR (per-bill rows are correct). Optional
  `currency` on the figure or a label suffix in the es module would fix the cosmetics. Cost: S.
