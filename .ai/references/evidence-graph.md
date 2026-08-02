# Evidence Graph

Graph 4 of the four in `.ai/context.md`. Its only job is to make "done" **provable** rather than
asserted. It is the structural enforcement of the Honesty protocol.

## The required path

```
requirement → behavior → implementation → test → passing evidence
```

Every link must be present and resolvable. A gap anywhere means the requirement is **not verified**.

| Link | What it is | Where it lives | How it is checked |
|---|---|---|---|
| **requirement** | a numbered requirement or acceptance criterion | `.ai/specs/00-requirements.md`, `<id>-spec.md`, or the external ticket | cited by id |
| **behavior** | the observable contract — what the system does, in one sentence | `<id>-spec.md` acceptance criteria | reviewed at stage 2 |
| **implementation** | the code or artifact that realizes it | `file:line` | path resolves |
| **test** | the automated check that would fail if the implementation broke | test `file:line` or a named case | test exists and is executed |
| **passing evidence** | the **pasted** output of running it | task report, `99-acceptance.md` | output is present verbatim |

## Two failure shapes, both blocking

- **Requirement without passing evidence → NOT VERIFIED.** No amount of confident prose substitutes.
  Mark it ⚠️ / ❌ / 🚫 with a reason.
- **Implementation without a requirement or invariant → UNEXPLAINED SCOPE.** Code exists that no
  approved criterion asked for. Either trace it to a requirement, or remove it. `/reconcile` detects
  this mechanically by comparing the actual diff against the union of node `write_set`s.

## Evidence quality

Evidence is **files, diffs, and command output**. It is never:

- a reviewer's approval ("code-reviewer says LGTM") — opinion is not test evidence;
- an agent or terminal-pane status (`idle`, `done`, `unknown`) — the multiplexer's own docs state
  `unknown` does not prove successful completion;
- a claim that a command "should" pass;
- a summary of output that was not actually produced.

An evidence entry records what was run and what came back:

```jsonc
{ "criterion": "AC3",
  "command": "pnpm test src/countries/es/report.test.ts",
  "output_excerpt": "Test Files  1 passed (1)\n     Tests  24 passed (24)",
  "file_ref": "src/countries/es/report.ts:97" }
```

## What the acceptance report must cover

`/acceptance` writes `.ai/specs/99-acceptance.md` with **one canonical matrix**:

| # | Requirement | Behavior | Implementation (`file:line`) | Test | Evidence | Status |
|---|---|---|---|---|---|---|

Statuses: ✅ verified · ⚠️ partial · 🔧 stubbed/mocked · ❌ not done · 🚫 blocked.
✅ requires BOTH implementation AND a passing test, with the proving output pasted.

Beyond per-requirement rows, the report must also carry a row per:

- **invariant** — the invariant, its test, and its passing output;
- **graph delta** — planned vs actual, per `/reconcile`;
- **loop transition** — each node's final state and the evidence for its last transition;
- **security boundary** — authorization filters exercised by a test;
- **tenancy boundary** — cross-household/tenant isolation proven, not assumed;
- **documentation** — docs updated for behavior that changed;
- **generated-contract synchronization** — `sh scripts/sync-ai-docs.sh` run and idempotent.

It ends with the **Honest Implementation Metric** (`verified ✅ ÷ total`), and the two lists that
are never omitted: **Unverified** and **Could-not-do**.

## Relationship to the other graphs

- The **task execution graph** (graph 2) holds the evidence per node while work is in flight.
- The **evidence graph** is the assembled, task-level and project-level view at close.
- The **repository reality graph** (graph 1) can suggest where evidence is missing; it never
  supplies evidence itself.
- The **financial domain graph** (graph 3) is a product artifact and plays no role here.
