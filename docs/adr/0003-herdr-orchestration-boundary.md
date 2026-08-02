# ADR 0003 — Herdr is an execution surface, not a source of truth

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** repository owner (human), lead agent

## Context

Development on this repository runs inside [Herdr](https://herdr.dev), a terminal and agent
multiplexer. It hosts multiple coding-agent panes, reports each agent's lifecycle state
(`working`, `blocked`, `done`, `idle`, `unknown`), and exposes a CLI and socket API that let one
agent create and drive others.

That capability invites two mistakes:

1. **Treating pane state as completion.** `herdr agent list` reporting `done` says a process settled.
   It says nothing about whether the work is correct, or was even attempted. Herdr's own
   documentation is explicit that `unknown` "does not prove successful completion". Recording work as
   verified because a pane said `done` is the cheapest possible way to write a false ✅ — precisely
   the failure mode this project's honesty protocol exists to prevent.
2. **Treating panes as parallel writers.** Multiple agents editing the same tightly-coupled contract
   files produces conflicting edits no merge can resolve.

A related operational constraint: full-screen agents (Claude Code, opencode) render in the terminal's
alternate screen, whose rows never enter Herdr's host scrollback. A read can therefore come back
truncated with no error.

## Decision

Herdr is adopted as an **execution and observability surface only**, with explicit boundaries.

**It is:** a way to run independent analyses concurrently · a way to make reviewers independently
observable · a way to obtain genuine cross-model diversity (e.g. a `codex`-kind reviewer auditing
work produced by Claude) · a way to keep long-running work alive across detach.

**It is not:** the workflow source of truth (that is `.ai/`) · the task-graph database (that is the
committed JSON) · the evidence store (that is files, diffs, and pasted command output) · a substitute
for repository specs · permission for several agents to modify the same files.

Operating rules:

1. **Agent status is visibility, not proof.** `idle`, `done`, and `unknown` are never evidence.
   Recorded as an invariant in the honesty protocol and as anti-pattern E in
   `.ai/references/orchestration-patterns.md`.
2. **One writer.** During contract and bootstrap work, exactly one agent writes. Parallel writers
   require disjoint write sets, no dependency path, non-overlapping schema ownership, and **separate
   git worktrees**, with the lead integrating and rerunning all global gates.
3. **Reviewers are read-only** and do not invoke other agents. No nested orchestration.
   **Observed 2026-08-02, during the review that produced this ADR:** a `codex` reviewer launched in
   a pane, given an explicit and repeated READ-ONLY instruction, nonetheless ran a command that added
   a `packageManager` key to `package.json` and then edited the file again to remove it. Net effect
   was zero, but the lesson is not: **"read-only" told to an external agent is a request, not a
   boundary.** Native sub-agents can be launched with write tools genuinely withheld; a full CLI in a
   pane cannot. Therefore: never run a pane agent against a dirty tree you cannot reconstruct, always
   `git status` before and after, and prefer native read-only sub-agents whenever the review does not
   specifically need cross-model diversity. Structural enforcement (a separate git worktree, or a
   read-only bind mount) is the only real fix; it is recorded as a Phase-1 item in
   `.ai/specs/98-nice-to-haves.md`.
4. **Truncated output has a defined fallback:** ask the affected reviewer to write its complete
   report to a path **outside the repository** and reply with the path only; then read that file.
   Orchestration temp files are never committed.
5. **Native sub-agents are the default** for read-only fan-out. Herdr panes are reached for when
   observability or model diversity is worth the extra weight — typically at `/consensus-review`,
   not for routine reads.
6. **The pipeline must work without Herdr.** Every stage is a slash command usable in any supported
   CLI. Herdr is an accelerant, and the repository must never acquire a dependency on it.

## Consequences

**Positive.** Concurrency and cross-model review become available without weakening the evidence
model. The distinction between "a process finished" and "the work is correct" is written down where
it will be read. Losing Herdr costs convenience, not capability.

**Negative.** Multi-pane reviews cost more than in-process sub-agents (each pane is a full CLI
session), and the alternate-screen caveat means some reads need a documented fallback rather than
just working.

**Accepted risk — and a measured example of it.** Herdr's CLI surface changes between versions, and
the published documentation tracks the newest release rather than the installed one. Verified here
on 2026-08-02:

| Published `agent-automation` docs (0.7.5) | Installed client (`herdr --version` → 0.7.1) |
|---|---|
| `herdr agent start <name> --kind codex --pane <id>` | no `--kind`, no `--pane`; use `herdr agent start <name> [--cwd P] [--workspace ID] [--split right\|down] -- <argv...>` |
| `herdr agent prompt <name> "…" --wait` | **does not exist**; use `herdr agent send <target> <text>` (literal text, no Enter — send a separate `\r` to submit) |
| `herdr pane send-keys`, `herdr pane wait-output` | not present in `herdr pane` help |
| `herdr agent wait --until <state>` | `herdr agent wait <target> --status <idle\|working\|blocked\|unknown>` |
| `herdr agent read --source recent-unwrapped` | present and working |

**Therefore: no Herdr CLI invocation is embedded in the committed contract.** Recipes belong in
local notes, not in `.ai/`, precisely because they expire. Run `herdr agent` and `herdr pane` with
no arguments to get the installed command surface before scripting anything. This is also why rule 6
exists — a pipeline that depended on these flags would already be broken.

## Alternatives considered

- **Drive the pipeline from Herdr's socket API.** Rejected: it would make an external tool the
  workflow source of truth and break every CLI that is not Herdr.
- **Ban multi-agent panes entirely.** Rejected: cross-model adversarial review is genuinely valuable
  at the consensus gate, and the risk is addressable with the read-only + one-writer rules.
- **Accept pane status as a completion signal for cheap tasks.** Rejected outright. A rule with an
  exception for "cheap" tasks is a rule that erodes; and the honesty protocol admits no tiers.
