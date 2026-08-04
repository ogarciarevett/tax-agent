---
description: Open ONE task — fix its id and spec source, record the blast radius, and write the behavioral contract for human approval
---

# /spec — stage 2, the behavioral contract

Invoke the agent-skills:spec-driven-development skill.

## 0. Identify (stage 0) — do this before writing anything

Detect the backlog source and **state which one you detected and how** (`.ai/context.md` → "Task
identity & spec source"):

- GitHub Projects → `gh project list` returns >= 1 project.
- Linear → a Linear MCP server configured in this repo's `.mcp.json`, `LINEAR_API_KEY` set, or
  `eng-123` branch/commit keys. A user-level connector this repo does not configure does NOT count.
- Inconclusive (e.g. `gh` lacks the `read:project` scope) → say so plainly and use the local scheme.
- Neither → local letter+number id (`A`/`B` = legacy epics, `P` = pipeline/platform).

Then classify the task: is it **financially material**? does it **change the operating contract**?
Both decide which reviewers are mandatory at `/consensus-review`.

## 1. Map

Run `/map` first (or its steps inline). You cannot scope what you have not looked at.

## 2. Write the spec

External backlog → the ticket IS the spec: read it, cite its id, do NOT create a local duplicate.
Otherwise → copy `.ai/specs/_task-spec.template.md` to `.ai/specs/<id>-spec.md` and fill:

- **Goal** — one sentence.
- **Scope / non-goals** — what this task explicitly does not do.
- **Acceptance criteria** — each testable, numbered; these become the Honest Implementation Report
  rows and the evidence-graph requirements.
- **Invariants** — properties that must hold after this task, each with the test that would catch a
  violation.
- **Tenancy & security boundaries** — who may read/write what; the authorization filter involved.
- **Data classification** — PII / financial fact / derived figure / public.
- **Graph delta** — the nodes and edges this task intends to add, modify, or remove.
- **Affected loops** — which state transitions change behavior.
- **Blast radius** — from `/map`, with `file:line` citations.
- **Eval row** — the feature's entry for `EVALS.md`: input, output, expected, and how each of the
  four surfaces (UI / backend log / DB / output) will be checked or why it is `n/a`. **A feature
  with no eval row is not specified.**
- **Risks & assumptions**, and **open decisions** that genuinely need a human.

If the task is already fully covered by the approved `.ai/specs/01-spec.md`, cite that section
instead of duplicating it. Trace UP to the project architecture; do not restate it. One task per
spec file.

## 3. Register and stop

Register the task id in the `.ai/specs/02-plan.md` index. Show the task id, where its spec lives,
and the acceptance criteria. Then **stop and get human approval** (`approved` / `change: …`).
Approval of the spec is a hard gate — `/plan` may not run before it.

Never invent an acceptance criterion you cannot test. An untestable criterion becomes an
unverifiable claim later, which is how false ✅ rows get written.
