# 02 — Task backlog & index

The local backlog: one row per TASK, each running the full per-task lifecycle
(`/map → /spec → /plan → /build → /reconcile → /test`). Written and updated by `/spec` and `/plan`.

- Status: active
- Backlog source: **local (`.ai/specs`)** — detected 2026-08-02: `gh project list` returned
  `missing required scopes [read:project]` (**undetermined, not absent**); no `LINEAR_API_KEY`;
  this repo's `.mcp.json` configures only `excalidraw`. Re-run detection after
  `gh auth refresh -s read:project`; if a project appears, later tasks switch to external ids.
- Derives from: [`01-spec.md`](./01-spec.md)
- Task graphs: [`task-graphs/`](./task-graphs/) — compiled per task, validated by
  `node scripts/validate-task-graph.mjs`

Epic letters: **A**, **B** = Legacy CLI v0 (frozen) · **P** = pipeline/platform contract.

## Task index

| Task id | Title | Spec | Task graph | Status |
|---------|-------|------|-----------|--------|
| A1 | opentui profile interview + local persistence | [`A1-spec.md`](./A1-spec.md) | — (pre-graph) | ✅ shipped — 4/5 AC ✅ (100% cov, 3/3 review); AC#1 ⚠️ live TUI needs a terminal |
| B0 | CLI router + stub commands | [`B0-spec.md`](./B0-spec.md) | — (pre-graph) | ✅ 4/4 AC (gates green, stubs + regression evidence) |
| B1 | Bill domain + AgentRunner seam + migrations + ingest repo | [`B1-spec.md`](./B1-spec.md) | — (pre-graph) | ✅ 5/5 AC (75 tests; legacy DB adopted user_version=2) |
| B2 | Agent-CLI adapter (claude/codex, model+effort) | [`B2-spec.md`](./B2-spec.md) | — (pre-graph) | ✅ 5/5 AC (real `claude -p` smoke PONG; codex stdin `-` pinned) |
| B3 | Scan task prompt + verification + file writer | [`B3-spec.md`](./B3-spec.md) | — (pre-graph) | ✅ 6/6 AC (33 tests; tolerance = ±1c/VAT line) |
| B4 | `es` country module + Spain fixtures | [`B4-spec.md`](./B4-spec.md) | — (pre-graph) | ✅ 5/5 AC (24 tests; 100% cov on module; traceability sweep) |
| B5 | `scan` orchestration + cron wiring | [`B5-spec.md`](./B5-spec.md) | — (pre-graph) | ✅ 5/6 AC (48 ingest tests; cron-context AC awaits the user's crontab install) |
| B6 | Month report renderer + TUI table + `report` cmd | [`B6-spec.md`](./B6-spec.md) | — (pre-graph) | ✅ 4/5 AC (golden renders + real-CLI piped run; TTY q-exit needs a human terminal) |
| B7 | Epic integration + live E2E + consensus review + acceptance | [`B7-spec.md`](./B7-spec.md) | — (pre-graph) | ✅ 3/3 panel APPROVE · live E2E (2 real bills) · user-side steps in 99-acceptance |
| **P1** | **Define and self-host the graph-orchestrated loop pipeline** | [`P1-spec.md`](./P1-spec.md) | [`task-graphs/P1.json`](./task-graphs/P1.json) | 🔵 in progress |

Status legend: ⬜ todo · 🔵 in progress · ✅ done (impl + passing test, evidence pasted) · 🚫 blocked.

> **A1–B7 predate Pipeline V2.** They shipped under the previous linear lifecycle and have no task
> graph. That is recorded as fact, not backfilled — a reconstructed graph would imply governance
> that did not exist. Their per-task decomposition is preserved in each `<id>-spec.md` and in
> [`99-acceptance.md`](./99-acceptance.md).

---

## P1 — Define and self-host the graph-orchestrated loop pipeline

**Normative spec:** [`P1-spec.md`](./P1-spec.md) · **Compiled graph:**
[`task-graphs/P1.json`](./task-graphs/P1.json)

Node decomposition, dependencies, read/write sets, invariants, verification commands, and evidence
live in the task graph — that is the point of compiling one. This section is an index, not a second
copy; duplicating node detail here would create exactly the drift the graph exists to prevent.

Selection and status:

```sh
node scripts/validate-task-graph.mjs --ready .ai/specs/task-graphs/P1.json
node scripts/validate-task-graph.mjs --reconcile .ai/specs/task-graphs/P1.json
```

**Bootstrap exception:** nodes N1–N4 were authored under the *previous* contract — Pipeline V2 did
not govern its own definition. They are marked `bootstrap_exception: true` in the graph rather than
implying self-governance. See [ADR 0001](../../docs/adr/0001-graph-orchestrated-loop-pipeline.md).

**Writers:** one (the lead). P0 modifies tightly coupled contract files; no node in P1 is built in
parallel, regardless of what the validator derives about write-set disjointness.

---

## Legacy epic B — waves & dependencies (historical, pre-graph)

Epic B executed in four waves under the previous lifecycle. Kept as the record of how it was
actually built:

- **Wave 1 (lead, sequential):** B0 → B1 — shared seams (`src/index.ts`, `src/storage/db.ts`,
  `vitest.config.ts`, `src/domain/`) land once, then freeze.
- **Wave 2 (3 sub-agents, file-disjoint):** B2 (`src/llm/**`) ∥ B3 (`src/ingest/**` minus
  `scan.ts`) ∥ B4 (`src/countries/**`).
- **Wave 3 (2 sub-agents):** B5 (`src/ingest/scan.ts`, `src/cli/scan.ts`, `scripts/cron-scan.sh`)
  ∥ B6 (`src/report/**`, `src/tui/table-view.ts`, `src/cli/report.ts`).
- **Wave 4 (lead):** B7 — integrated gates, live E2E, consensus review, acceptance, local commits.

Under Pipeline V2 these "waves" are expressed as dependency edges and disjoint write sets, and
parallel safety is **derived** by the validator rather than declared in prose. Parallel *writers*
additionally require separate git worktrees.

## Parallel-work notes

Read-only fan-out is always safe. Parallel writers are permitted only when no dependency path
exists, write sets are disjoint, schema ownership does not overlap, shared invariants are not
modified concurrently, each writer uses a **separate git worktree**, and the lead integrates and
reruns all global gates. Contract and bootstrap work is always single-writer.

Do not parallelize a linear dependency chain — the 3–5× token cost buys nothing when every node
blocks on the previous one.
