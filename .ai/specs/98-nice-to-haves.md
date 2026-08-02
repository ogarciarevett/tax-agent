# 98 — Nice-to-haves & deferred backlog

Out-of-scope items and the `/consensus-review` findings not fixed now, split into applied and
deferred-with-rationale. Append as you go — `/test`, `/review` and `/consensus-review` feed this.

## P1 deferred (2026-08-02) — pipeline contract

Deferred **with reason**, not forgotten. Each governs work that does not exist yet; writing them now
would produce aspirational documentation nobody follows.

### Skills — Phase 1
- **`ledger-design-and-reconciliation`** — needs a ledger to design against. Blocked on the Phase-1
  schema decision. Cost: M.
- **`financial-scenario-evaluation`** — needs immutable scenario inputs to exist. Cost: M.
- **`financial-rag-evaluation`** — blocked on the lexical-ranking ADR (§8 of `01-spec.md`); an
  evaluation skill written before the retrieval implementation is chosen would evaluate nothing. Cost: M.
- **`jurisdiction-plugin-development`** — write it alongside the first port of
  `src/countries/es/rules.ts` into the new module, so it documents a real port rather than a guess. Cost: M.
- **`financial-security-and-privacy`** — blocked on the tenancy-enforcement and auth ADRs. Cost: M.

### Personas — Phase 1
- **`financial-domain-reviewer`**, **`ledger-invariant-reviewer`** — named in the consensus matrix in
  `.ai/context.md` and required for financially material work. Authored when there is a ledger to
  review. Until then, financially material work cannot pass `/consensus-review` — which is the
  intended behavior, not a gap. Cost: S each.

### Enforcement gaps found by the P1 consensus panel (Phase 1)
- **Read-only is unenforceable for pane agents.** A `codex` reviewer given an explicit READ-ONLY
  instruction still edited `package.json` (ADR 0003). Structural fix: run pane reviewers in a
  separate `git worktree`, or a read-only bind mount, so the boundary is enforced rather than asked
  for. Cost: S.
- **No transition checker.** "Invalid transitions fail loudly" is prose. A `--transition <from> <to>`
  mode on the validator would encode the table as a literal map and make it a non-zero exit.
  `financial-loop-engineering` already declares transition tests mandatory; none exist. Cost: S.
- **No `attempts` or `base_ref` in the node schema.** The 3-strikes retry bound and the reconcile
  window are both session memory today, so a resumed agent cannot reconstruct either. Cost: S.
- **Approvals are unrecorded.** No `spec_approved_by` / timestamp / commit ref, so a resuming agent
  cannot distinguish an approved spec from a draft, and `/ship` verifies the consensus verdict by
  reading a file the agent itself wrote. Cost: M.
- **`/reconcile` is not run by any automation** — not by the pre-commit hook, not by CI (there is no
  CI). It is the lead typing the command. Adding it to CI is the honest fix; adding it to
  pre-commit would block unrelated commits. Cost: S.
- **`validateGraph` is ~190 lines**, over the repo's own >50-line review bar even after being split
  into `validateHeader` / `validateNode` / `findCycles`. Cost: S.

### Second security seat — deferred with reason (Phase 1)
- **M1 — the pre-commit hook executes repository content.** `20-test.sh` runs `pnpm test` (vitest over
  `src/**/*.test.ts`) and the validator self-test; its siblings only *analyze*. Any branch or
  `git pull` that lands a test file gets code execution at the human's next commit. Defensible, but
  it is a threat-model change ADR 0001 does not record. Add the note; move the suite to CI. Cost: S.
- **M2 — `verification_commands` is untrusted data the pipeline tells an agent to execute.** The
  validator checks only non-emptiness, so a `✓`-valid graph carries commands the validator appears
  to have blessed. Document that a task graph is executable content and must be reviewed as such. Cost: S.
- **M3 — coverage threshold is a global average.** `vitest.config.ts` has no `perFile: true`, so a
  new money module at 0% cannot break the gate. **Enabling it fails today** (`ingest-repo.ts` is at
  75% branches), so it needs tests first or a targeted per-module threshold. Cost: M.
- **M5 — no secret scanner.** "no secrets or PII in logs" and "NEVER commit .env or any secret" are
  enforced by one unit test over one sink; `.gitignore` matches filenames only, so a key pasted into
  a `.ts` or `.md` commits with no friction. Add `gitleaks`/`secretlint` to `pre-commit.d/`. Cost: S.
- **M6 — two "mandatory" consensus personas do not exist** (`financial-domain-reviewer`,
  `ledger-invariant-reviewer`). Intended (they need a ledger), but `.ai/context.md` should say so
  inline where it names them. Cost: S.
- **L4 — `spec_source` symlink.** Absolute paths and `..` are rejected, but a repo-relative symlink
  still reads out-of-tree. Content is only mined for integers, so impact is negligible. Cost: S.

### Security findings deferred with reason (Phase 1)
- **M2 — no size/cardinality limits on graph or spec files.** A huge or dense JSON graph could
  exhaust heap/CPU during the every-commit hook. Not fixed: the graphs are repo-local and
  human-authored, so the attack requires an already-untrusted checkout. Fix with a `stat` size cap
  plus node/edge/string limits. Cost: S.
- **M5 — `10-biome.sh` filename argument injection.** `$staged` is expanded unquoted, so a crafted
  staged path shaped like a Biome option (`--config-path=….ts`) is read as an option, not a file.
  **Pre-existing, not introduced by P1**, and outside every P1 node's write set — fixing it here
  would have been unexplained scope. Fix: `git diff --cached --name-only -z` with a NUL-safe
  mechanism and `--` before file operands. Cost: S. **Do this before the repo is shared.**
- **M6 (partial) — the pre-commit gate tests the working tree, not the staged index.** Now fails
  closed on a missing toolchain, but a partially-staged commit is still tested against different
  content than it commits. Real fix: test an isolated index snapshot, or rely on CI. Cost: M.

### Decisions carried forward
- **Lexical ranking implementation** — PostgreSQL `ts_rank` must not be called BM25 unless it is.
  Identify, benchmark, and ADR **before** retrieval production code. Cost: M.
- **Tenancy enforcement mechanism** — application-level scoping vs row-level security. Needs an ADR
  with evidence. Cost: M.
- **Authentication/session model** and **document-at-rest encryption**. Cost: M.
- **Legacy v0 retirement criteria** — what must be ported and verified before `src/**` is removed. Cost: S.
- **CI** — no `.github/` exists. The pre-commit gates are per-clone opt-in
  (`git config core.hooksPath .githooks`), so nothing enforces tests on a shared branch. A workflow
  running `pnpm test`, `tsc`, `biome`, the task-graph validator, and
  `sh scripts/sync-ai-docs.sh && git diff --exit-code` would close it. Deferred: out of P0 scope,
  and only useful once the repo is pushed. Cost: S.
- **`.ai/specs/03-review.md` and `99-acceptance.md` still carry legacy-shaped tables.** They are
  rewritten by their own commands; the single canonical matrix defined in
  `.ai/references/evidence-graph.md` applies from P1 onward. Cost: S.

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
