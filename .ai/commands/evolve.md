---
description: "Stage 13 — diff code-reality against the .ai/ contract, specs, task graphs and loop specs; write proposed patches to .ai/specs/97-evolution.md (proposes, never applies)"
---

Invoke the `evolve` skill.

`/evolve` keeps the `.ai/` source-of-truth honest. It works in **every CLI** and it
**proposes, never applies** — a human reviews the output and applies what is right.

1. **Map reality.**
   - *Claude Code (accelerated):* build/reuse a `/graphify` knowledge graph (`graphify-out/`).
   - *Any CLI (fallback):* read the repo directly with grep/glob — and if graphify is not
     installed, this is the path on Claude Code too. Say which path you took.
2. **Scan for drift** across these dimensions, comparing ground truth to the matching `.ai/` source:
   - **contract** — `.ai/context.md` vs what the repo actually does
   - **stack** — declared locked stack vs installed dependencies and config
   - **specs** — `.ai/specs/00-requirements.md` / `01-spec.md` vs implemented behavior
   - **pipeline** — `.ai/pipeline.md` vs the commands, personas and skills that exist
   - **surface** — exposed interfaces, CLI, routes, schemas
   - **task graphs** — every `.ai/specs/task-graphs/*.json`: does its `write_set` still describe
     reality? are `VERIFIED` nodes still backed by passing tests? run
     `node scripts/validate-task-graph.mjs` over all of them and paste the result
   - **loop state machines** — `.ai/references/loop-state-machines.md` vs the transitions the
     commands actually perform
   - **financial domain graph schema** — the declared schema vs the migrations in the repo
     (no-op while graph 3 is unimplemented — say so rather than inventing findings)

   Fan the checks across the tool's native sub-agents (see "Parallel work" in `.ai/pipeline.md`),
   or run them sequentially if the run is small. Brief each with the dimension's `.ai/` source plus
   the actual files. Read-only; no nested orchestration.
3. **Report:** write `.ai/specs/97-evolution.md` — drift table plus concrete proposed patches to
   `.ai/` sources only, **never to generated files** — with a one-line verdict.
4. **Hand off:** stop there. Applying a patch means editing the `.ai/` source, then running
   `sh scripts/sync-ai-docs.sh`.

Ground truth wins: where code and doc disagree, the code is what is true — unless the doc encodes an
intentional rule the code violates, in which case flag it as a **code** bug, not a doc drift.

See the `evolve` skill for full detail and the report template.
