# Agent Personas

Specialist personas that play a single role with a single perspective. Each persona is a Markdown file consumed as a system prompt by your harness (Claude Code, Codex, Gemini, opencode, Cursor…).

| Persona | Role | Best for |
|---------|------|----------|
| [code-reviewer](code-reviewer.md) | Senior Staff Engineer | Five-axis review before merge |
| [security-auditor](security-auditor.md) | Security Engineer | Vulnerability detection, OWASP-style audit |
| [test-engineer](test-engineer.md) | QA Engineer | Test strategy, coverage analysis, Prove-It pattern |
| [performance-reviewer](performance-reviewer.md) | Performance Engineer | Hot-path / allocation / query-cost review |
| [graph-consistency-reviewer](graph-consistency-reviewer.md) | Graph Specialist | DAG semantics, source-of-truth separation, write-set discipline, graph overengineering |
| [loop-correctness-reviewer](loop-correctness-reviewer.md) | Loop Specialist | State transitions, retry, resume, idempotency, compensation, approval points |

**Declared but not yet authored** (they are named in the contract's consensus matrix and will be
written when there is a ledger to review — see `.ai/specs/98-nice-to-haves.md`):
`financial-domain-reviewer`, `ledger-invariant-reviewer`.

## How personas relate to skills and commands

Three layers, each with a distinct job:

| Layer | What it is | Example | Composition role |
|-------|-----------|---------|------------------|
| **Skill** | A workflow with steps and exit criteria | `code-review-and-quality` | The *how* — invoked from inside a persona or command |
| **Persona** | A role with a perspective and an output format | `code-reviewer` | The *who* — adopts a viewpoint, produces a report |
| **Command** | A user-facing entry point | `/review`, `/consensus-review` | The *when* — composes personas and skills |

The user (or a slash command) is the orchestrator. **Personas do not call other personas.** Skills are mandatory hops inside a persona's workflow.

## When to use each

### Direct persona invocation
Pick this when you want one perspective on the current change and the user is in the loop.

- "Review this PR" → invoke `code-reviewer` directly
- "Are there security issues in this query layer?" → invoke `security-auditor` directly
- "Is this state machine resumable?" → invoke `loop-correctness-reviewer` directly

### Slash command (single persona behind it)
Pick this when there's a repeatable workflow you'd otherwise re-explain every time.

- `/review` → wraps `code-reviewer` with the project's review skill
- `/test` → wraps `test-engineer` with the TDD skill

### Slash command (orchestrator — fan-out)
**`/consensus-review` is the ONLY fan-out command in this repo.** It runs the mandatory reviewer
panel in parallel and synthesizes the verdict.

`/ship` is **mechanical** — it verifies gates, prints status and log, and produces a PR body. It
does **not** fan out to personas; duplicating the panel there would re-derive a verdict that
`/consensus-review` already produced.

The panel is decided by what changed, not by a fixed count (`.ai/context.md` → "Consensus review"):

| Change class | Mandatory reviewers |
|---|---|
| Pipeline-contract (`.ai/**`, `scripts/**`, `.githooks/**`) | `code-reviewer` · `graph-consistency-reviewer` · `loop-correctness-reviewer` · `security-auditor` |
| Financially material product logic | `code-reviewer` · `financial-domain-reviewer` · `ledger-invariant-reviewer` · `security-auditor` (+ graph / loop reviewers when those behaviors change) |
| Ordinary product change | `code-reviewer` · `security-auditor` · `performance-reviewer` |

**Approval rule:** no unresolved critical finding · no unresolved high-severity financial, security,
invariant, graph, or loop finding · **every mandatory correctness reviewer approves**. Majority
voting cannot override a correctness proof failure.

## Decision matrix

```
Is the work a single perspective on a single artifact?
├── Yes → Direct persona invocation
└── No  → Is this the stage-8 correctness gate?
         ├── Yes → /consensus-review (parallel fan-out, mandatory panel)
         └── No  → Sequential slash commands run by the user
                   (/map → /spec → /plan → /build → /reconcile → /test)
```

## Worked example: valid orchestration

`/consensus-review` on a pipeline-contract change:

```
/consensus-review
  ├── (parallel) code-reviewer               → review report
  ├── (parallel) graph-consistency-reviewer  → graph report
  ├── (parallel) loop-correctness-reviewer   → loop report
  └── (parallel) security-auditor            → audit report
                  ↓
        synthesis (lead, main context)
                  ↓
        verdict + .ai/specs/03-review.md
```

Why this works:
- Each sub-agent operates on the same diff but produces a **different kind** of finding
- They have no dependencies on each other → genuine parallelism
- Each runs in a fresh context window → the main session stays uncluttered
- The synthesis is small and benefits from full context, so it stays with the lead

**Verify reviewer claims before acting on them.** A reviewer is a perspective, not an oracle. Where
a finding is mechanically checkable — a path, a test result, a validator output — check it. Do not
accept a destructive recommendation on majority opinion.

## Worked example: invalid orchestration (do not build this)

A `meta-orchestrator` persona whose job is "decide which other persona to call":

```
/work-on-pr → meta-orchestrator
                  ↓ (decides "this needs a review")
              code-reviewer
                  ↓ (returns)
              meta-orchestrator (paraphrases result)
                  ↓
              user
```

Why this fails:
- Pure routing layer with no domain value
- Adds two paraphrasing hops → information loss + 2× token cost
- The user already knows they want a review; let them call `/review` directly
- Replicates work that slash commands and `AGENTS.md` intent-mapping already do

## Rules for personas

1. A persona is a single role with a single output format. If you find yourself adding a second role, create a second persona.
2. **Personas do not invoke other personas.** Composition is the job of slash commands or the user. On Claude Code this is also a hard platform constraint — *"subagents cannot spawn other subagents"* — so the rule is enforced for you. **No nested orchestration.**
3. **Never create** a meta-orchestrator, a router persona, or a persona that owns the whole pipeline.
4. A persona may invoke skills (the *how*).
5. Personas are **read-only**. The lead applies fixes and re-runs the integrated checks.
6. Every persona file ends with a "Composition" block stating where it fits.

## Harness interop

These personas are plain Markdown with `name` + `description` frontmatter, and work as sub-agents in
every supported CLI. `sh scripts/sync-ai-docs.sh` copies them into each tool's (gitignored) mirror:
`.claude/agents/`, `.opencode/agents/`, `.gemini/agents/`.

- **Claude Code:** use the Agent tool with `subagent_type` matching the persona's `name` field.
  Issue all fan-out calls in a **single assistant turn** so they run in parallel — sequential turns
  serialize execution.
- **Codex / Gemini / opencode:** launch the tool's native sub-agents with the same persona bodies.
- **User-level overrides win.** A `code-reviewer` you define in `.claude/agents/` or
  `~/.claude/agents/` takes precedence over this repo's copy.

An external terminal multiplexer (e.g. Herdr) may instead host each reviewer in its own pane — useful
when you want reviewers that are independently observable, or genuine cross-model diversity (e.g. a
`codex`-kind reviewer auditing work done by Claude). It remains an **execution and observability
surface only**: never the source of truth, never the evidence store, and never permission for two
agents to write the same file. Pane status (`idle`, `done`, `unknown`) is visibility, not proof.
See [docs/adr/0003-herdr-orchestration-boundary.md](../../docs/adr/0003-herdr-orchestration-boundary.md).

## Parallel writers

Read-only fan-out is always safe. **Parallel *writers* are not.** They are permitted only when no
dependency path exists between the nodes, write sets are disjoint, schema ownership does not
overlap, shared invariants are not modified concurrently, **each writer uses a separate git
worktree**, and the lead integrates and reruns all global gates. Contract and bootstrap work is
always single-writer.

## Adding a new persona

1. Create `.ai/agents/<role>.md` with the same frontmatter format used by existing personas.
2. Define the role, scope, output format, and rules.
3. Add a **Composition** block at the bottom (Invoke directly when / Invoke via / Do not invoke from another persona).
4. Add the persona to the table at the top of this file.
5. If the persona changes the consensus matrix, update `.ai/context.md` — that is where the matrix lives.
6. If the persona enables a new orchestration pattern, document it in [references/orchestration-patterns.md](../references/orchestration-patterns.md) rather than inventing the pattern in the persona file itself.
7. Run `sh scripts/sync-ai-docs.sh`.
