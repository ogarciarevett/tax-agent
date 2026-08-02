---
description: Stage 10 — mechanical close. Verify the tree, print status and log, and produce a ready-to-paste PR body. Never pushes, never reviews.
---

# /ship — stage 10, SHIP PREPARATION

Invoke the agent-skills:shipping-and-launch skill.

`/ship` is **mechanical**. It does not run a reviewer panel — that is `/consensus-review` at stage 8,
and duplicating it here would burn tokens to re-derive a verdict that already exists.

**Preconditions (verify, do not assume):**
- every node in the task graph is `VERIFIED`;
- `/consensus-review` passed and `.ai/specs/03-review.md` records the verdict;
- all Definition-of-Done gates are green.

## Steps

1. **Prove the gates.** Run and paste:
   - `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm exec biome check`
   - `node scripts/validate-task-graph.mjs .ai/specs/task-graphs/<id>.json`
   - `sh scripts/sync-ai-docs.sh` then `git diff --exit-code -- AGENTS.md CLAUDE.md GEMINI.md`
     (generated contract in sync)
   - `git diff --check` (no whitespace errors or conflict markers)
2. **Confirm the commit history is atomic** — one commit per verified node, each citing its task
   and node id. `/build` made these; `/ship` does not create content commits. If the tree is dirty
   with report artifacts only (acceptance, review), a single final commit for those is allowed.
3. **Print `git status --short`** (must be clean) and **`git log --oneline`** for the task's range.
4. **Produce the PR body** — ready to paste, referencing the task graph and acceptance artifacts:

```markdown
## <task-id> — <title>

### What changed
- <one bullet per verified node, with its node id>

### Why
<link or cite the normative spec: .ai/specs/<id>-spec.md or the external ticket>

### Verification
- Task graph: `.ai/specs/task-graphs/<id>.json` — N nodes, all VERIFIED
- Consensus review: `.ai/specs/03-review.md` — <verdict>
- Acceptance: `.ai/specs/99-acceptance.md` — Honest Implementation Metric NN%
- Gates: <pasted summary lines from step 1>

### Risks / follow-ups
- <deferred findings, pointing at .ai/specs/98-nice-to-haves.md>
```

## Hard rules

**NEVER push. NEVER open a PR. NEVER create a remote branch. NEVER deploy.** Commit locally; the
human pushes. `/ship` prints the PR body for a human to paste — it does not create one.

If a gate fails, `/ship` stops and reports. It does not "ship anyway with acknowledged risk" — that
decision belongs to the human, after seeing the failing output.
