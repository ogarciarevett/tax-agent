# Orchestration Patterns

Reference catalog of agent orchestration patterns this repo endorses, plus anti-patterns to avoid. Read this before adding a slash command that coordinates multiple personas, or before introducing a persona that "wraps" existing ones.

The governing rule: **the user (or a slash command) is the orchestrator. Personas do not invoke other personas.** Skills are mandatory hops inside a persona's workflow. There is **no nested orchestration**.

---

## Endorsed patterns

### 1. Direct invocation (no orchestration)

Single persona, single perspective, single artifact. The default and the cheapest option.

```
user → code-reviewer → report → user
```

**Use when:** the work is one perspective on one artifact and you can describe it in one sentence.

**Examples:**
- "Review this change" → `code-reviewer`
- "Is this state machine resumable?" → `loop-correctness-reviewer`
- "Does this task graph override its spec?" → `graph-consistency-reviewer`

**Cost:** one round trip. The baseline you should always compare orchestrated patterns against.

---

### 2. Single-persona slash command

A slash command that wraps one persona with the project's skills. Saves the user from re-explaining the workflow every time.

```
/review → code-reviewer (with code-review-and-quality skill) → report
```

**Use when:** the same single-persona invocation happens repeatedly with the same setup.

**Examples in this repo:** `/review`, `/test`, `/code-simplify`.

**Anti-signal:** if the slash command's body is mostly "decide which persona to call," delete it and let the user call the persona directly.

---

### 3. Parallel fan-out with merge

Multiple personas operate on the same input concurrently, each producing an independent report. A merge step (in the lead's context) synthesizes them into a single decision.

```
                              ┌─→ code-reviewer               ─┐
/consensus-review → fan out ──┼─→ graph-consistency-reviewer  ─┤→ synthesis → verdict
                              ├─→ loop-correctness-reviewer   ─┤
                              └─→ security-auditor            ─┘
```

**The only fan-out command in this repo is `/consensus-review`** (stage 8). `/ship` is mechanical and does not repeat the panel — re-deriving an existing verdict is pure cost. The mandatory panel is decided by *what changed*, not by a fixed count; see `.ai/context.md` → "Consensus review".

**Use when:**
- The sub-tasks are genuinely independent (no shared mutable state, no ordering dependency)
- Each sub-agent benefits from its own context window
- The merge step is small enough to stay in the lead's context
- Wall-clock latency matters

**Cost:** N parallel sub-agent contexts + one merge turn. Higher than direct invocation, but faster wall-clock and better reports, because each sub-agent stays focused on one perspective.

**Validation checklist before adopting this pattern elsewhere:**
- [ ] Can I run all sub-agents at the same time without ordering issues?
- [ ] Does each persona produce a different *kind* of finding, not the same finding from a different angle?
- [ ] Will the merge step fit in the lead's remaining context?
- [ ] Is the wait long enough that parallelism is actually noticeable?

If any answer is "no," fall back to direct invocation or a single-persona command.

**Verify before you act.** A reviewer is a perspective, not an oracle. Where a finding is mechanically checkable — a path, a test result, a validator exit code — check it against ground truth. Do not accept a destructive recommendation on majority opinion. (This is not hypothetical: an audit pass in this repo once recommended deleting four skills as "dead weight" based on a contract that had already changed.)

---

### 4. Sequential pipeline as user-driven slash commands

The user runs slash commands in a defined order, carrying context (or the committed task graph) between them. There is no orchestrator agent — the user IS the orchestrator.

```
user runs:  /map → /spec → /plan → /build → /reconcile → /test → /consensus-review → /ship
```

**Use when:** the workflow has dependencies (each step needs the previous step's output) and human judgment between steps adds value.

**Examples in this repo:** the entire Pipeline V2 lifecycle (`.ai/pipeline.md`).

**Why not automate it:** an LLM "lifecycle orchestrator" would (a) lose nuance between steps because it has to summarize for hand-off, (b) skip the human approval gates that catch wrong-direction work early, and (c) double the token cost via paraphrasing turns.

**What carries state instead:** the committed task graph. `.ai/specs/task-graphs/<id>.json` holds each node's status and evidence, so a fresh session — or a different agent entirely — resumes by recomputing readiness. No hidden session state, no orchestrator required.

---

### 5. Research isolation (context preservation)

When a task requires reading large amounts of material that shouldn't pollute the lead's context, spawn a read-only sub-agent that returns only a digest.

```
lead → research sub-agent (reads 50 files) → digest → lead continues
```

**Use when:**
- The main session needs to stay focused on a downstream task
- The investigation result is much smaller than the input it consumes
- Decision quality benefits from the lead having room to think afterwards

**Examples:** "Inventory every command and report which skill each references," "Summarize what these 30 ADRs say about caching."

**On Claude Code, use the built-in `Explore` sub-agent** rather than defining a custom research persona. It is read-only and purpose-built for this pattern. Define a custom research sub-agent only when `Explore` doesn't fit.

---

## Harness mapping

This catalog is harness-agnostic. `sh scripts/sync-ai-docs.sh` fans the personas in `.ai/agents/` into each tool's (gitignored) mirror — `.claude/agents/`, `.opencode/agents/`, `.gemini/agents/` — so the same persona body works everywhere.

- **Claude Code:** Agent tool with `subagent_type` matching the persona's `name`. Parallel fan-out requires issuing **all Agent calls in a single assistant turn**; sequential turns serialize execution. User-level definitions in `.claude/agents/` or `~/.claude/agents/` take precedence over this repo's copies.
- **Codex / Gemini / opencode:** the tool's native sub-agents, same persona bodies.
- **Platform-enforced:** Claude Code documents that *"subagents cannot spawn other subagents."* Anti-patterns B and D below cannot exist there by construction.

### External multiplexer (Herdr and similar)

A terminal multiplexer can host each role in its own pane. This is worth doing when you want reviewers that are **independently observable**, or **genuine cross-model diversity** (e.g. a `codex`-kind reviewer auditing work produced by Claude) — a real benefit at the consensus gate, and unnecessary overhead for routine reads.

Boundaries, without exception:

| It IS | It is NOT |
|---|---|
| an execution surface | the workflow source of truth |
| an observability surface | the task-graph database |
| a way to run independent analyses concurrently | the evidence store |
| | permission for two agents to edit the same files |

**Pane and agent status is visibility, not proof.** `idle`, `done`, and `unknown` say nothing about correctness — the tooling's own documentation states that `unknown` does not prove successful completion. Evidence is files, diffs, and command output.

**Truncated output:** full-screen agents render in the terminal's alternate screen, whose rows never enter host scrollback, so a read can come back short. Ask the affected reviewer to write its complete report to a path **outside the repository** and reply with the path only; then read that file. Never commit orchestration temp files.

See `docs/adr/0003-herdr-orchestration-boundary.md`.

---

## Parallel writers

Every pattern above is **read-only** fan-out, which is always safe. Parallel *writers* are a different problem and are forbidden by default.

Parallel implementation nodes are permitted ONLY when all of these hold:
- no dependency path exists between them;
- write sets are disjoint (`parallel_safe` is **derived** by `scripts/validate-task-graph.mjs`, never authored);
- schema ownership does not overlap;
- shared invariants are not being modified concurrently;
- each writer uses a **separate git worktree**;
- the lead integrates and reruns all global gates.

**Contract and bootstrap work is always single-writer**, because contract files are tightly coupled and competing edits to `.ai/context.md`, `.ai/pipeline.md`, commands, or specs cannot be merged mechanically.

---

## Anti-patterns

### A. Router persona ("meta-orchestrator")

A persona whose job is to decide which other persona to call.

```
/work → router-persona → "this needs a review" → code-reviewer → router (paraphrases) → user
```

**Why it fails:** pure routing layer with no domain value · two paraphrasing hops → information loss and roughly 2× token cost · the user already knew they wanted a review · replicates what slash commands and `AGENTS.md` intent-mapping already do.

**Instead:** add or refine slash commands.

---

### B. Persona that calls another persona

A `code-reviewer` that internally invokes `security-auditor` when it sees auth code.

**Why it fails:** personas produce a single perspective, and chaining defeats that · the summary passed along loses context the called persona needs · failure modes multiply (whose output format wins?) · hides cost from the user.

**Instead:** have the calling persona *recommend* a follow-up audit in its report. The user or a slash command runs the second pass.

---

### C. Sequential orchestrator that paraphrases

An agent that calls `/spec`, then `/plan`, then `/build` on the user's behalf.

**Why it fails:** loses the human approval gates that catch wrong-direction work early · each hand-off summarizes context, accumulating drift · doubles token cost · removes user agency exactly where judgment matters most.

**Instead:** keep the user as orchestrator. The committed task graph carries state between steps.

---

### D. Deep persona trees

`/consensus-review` calls a `review-coordinator` that calls a `quality-coordinator` that calls `code-reviewer`.

**Why it fails:** each layer adds latency and tokens with no decision value · debugging becomes multi-level · leaf personas lose context to repeated summarization.

**Instead:** keep orchestration depth at most 1 (slash command → personas). The merge happens in the lead's context.

---

### E. Treating agent status as completion

Reading `done` or `idle` from a pane, task list, or agent registry and recording the work as verified.

**Why it fails:** status reflects process state, not correctness. An agent can finish cleanly having done the wrong thing, or nothing at all. This is the single easiest way to write a false ✅.

**Instead:** require files, diffs, and pasted command output. See `.ai/references/evidence-graph.md`.

---

## Decision flow

```
Is the work one perspective on one artifact?
├── Yes → Direct invocation. Stop.
└── No  → Is this the stage-8 correctness gate?
         ├── Yes → /consensus-review (mandatory panel, parallel fan-out).
         └── No  → Will the same composition repeat?
                  ├── No  → Direct invocation, ad hoc. Stop.
                  └── Yes → Are sub-tasks independent AND read-only?
                           ├── No  → Sequential slash commands run by the user (Pattern 4).
                           └── Yes → Parallel fan-out with merge (Pattern 3).
                                    Validate against the checklist above.
```

---

## When to add a new pattern to this catalog

Add a new entry only after:

1. You've used the pattern at least twice in real work
2. You can name a concrete artifact in this repo that demonstrates it
3. You can explain why an existing pattern wouldn't have worked
4. You can describe its anti-pattern shadow (what people will mistakenly build instead)

Premature catalog entries become aspirational documentation that no one follows.
