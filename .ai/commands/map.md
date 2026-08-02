---
description: Map repository reality for ONE task — impacted modules, tests, invariants, loops and generated artifacts, and the resulting blast radius
---

# /map — stage 1, current-state map

Build the **repository reality graph** (graph 1 of four — see `.ai/context.md`) for the task at hand
and calculate its blast radius. This is the input to `/spec`, not a substitute for it.

**`/map` performs no writes.** Its findings are recorded by `/spec` in the spec's *Blast radius*
section. Nothing here is normative: the repository tells you what IS, never what SHOULD BE.

## Steps

1. **Build or reuse the reality map.**
   - *Claude Code (accelerated):* reuse `graphify-out/graph.json` if present, else `/graphify .`.
   - *Any other CLI, or no graphify:* scan directly with Grep/Glob/Read. Say which path you took —
     a direct scan is shallower, and the report must be honest about that.
2. **Identify what the task touches.** Modules and files · schemas and migrations · tests ·
   docs · skills, commands, personas, references · generated artifacts (`AGENTS.md`, `CLAUDE.md`,
   `GEMINI.md`, the gitignored mirrors).
3. **Identify existing invariants** in the touched area — the properties that must still hold
   afterwards. Quote them with `file:line`. An invariant you cannot cite is an assumption.
4. **Identify affected loops** — which node-loop or product-loop transitions change behavior.
5. **Identify affected domain-graph concepts** — which financial relationships, provenance edges, or
   exposures are implicated. (In the pipeline phase this is usually "none"; say so.)
6. **Calculate blast radius.** Direct writes → transitive importers → tests covering them →
   docs asserting the old behavior. Name the widest ring you can justify with evidence.
7. **Report.** Impacted set, invariants, affected loops, blast radius, and the risks you would
   want the spec to answer. Flag anything that looks like it needs a human decision.

## Rules

- Read-only. If you find yourself editing, you have left `/map`.
- Cite `file:line` for every claim. "Probably touches X" is not a finding.
- Report what actually exists, including "this does not exist yet" — do not assume scaffolding.
- Fan out with read-only sub-agents when the surface is wide; brief each with real paths, not
  guesses. Reviewers never invoke other reviewers.

Next: `/spec` records the map and defines the behavioral contract.
