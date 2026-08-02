---
description: "Stage 8 — the ONLY reviewer fan-out. Mandatory-reviewer panel structured as a Six-Hats deliberation; writes .ai/specs/03-review.md"
---

# /consensus-review — stage 8, the correctness gate

**This is the only stage that fans out to reviewer personas.** `/ship` is mechanical and does not
repeat it. Structure the panel and the synthesis with the `six-thinking-hats` skill: reviewers wear
the ⚫ Black / ⚪ White lenses on their axis; the lead adds 🟡 Yellow + 🟢 Green + 🔵 Blue in synthesis.

## The panel is decided by what changed — not by a fixed count

Per `.ai/context.md` → "Consensus review":

| Change class | Mandatory reviewers |
|---|---|
| **Pipeline-contract** (`.ai/**`, `scripts/**`, `.githooks/**`) | `code-reviewer` · `graph-consistency-reviewer` · `loop-correctness-reviewer` · `security-auditor` |
| **Financially material product logic** | `code-reviewer` · `financial-domain-reviewer` · `ledger-invariant-reviewer` · `security-auditor` (+ `graph-consistency-reviewer` if graph behavior changes, + `loop-correctness-reviewer` if workflow behavior changes) |
| **Ordinary product change** | `code-reviewer` · `security-auditor` · `performance-reviewer` |

## Steps

0. **Freeze the target.** Record the exact SHA (or stash-and-commit first). **Do not edit the files
   under review while the panel runs.** A panel that reviewed a moving tree cannot honestly report
   consensus — this happened during P1 and every finding had to be re-verified against a commit.
1. 🔵 **Blue (frame).** State what is under review and the pass/fail criteria. Gather ground truth:
   the diff, the relevant `.ai/specs/` sections, the task graph, and the actual source files.
   Brief every reviewer with **verified context — never guesses**.
2. ⚫⚪ **Black + White (audit), in parallel.** Launch the mandatory reviewers **concurrently** —
   issue all Agent tool calls in a single turn in Claude Code, or the tool's native sub-agents in
   Codex / Gemini / opencode. Each runs in its own context and judges its axis against evidence.
   Reviewers are read-only, do not call each other, and there is **no nested orchestration**.
   Each returns a verdict plus findings, every risk with a concrete reason and a `file:line`.
3. 🟡🟢 **Yellow + Green (synthesis).** Name what is *good and worth preserving* (Yellow — the
   Chesterton's-Fence handoff to `/code-simplify`: do not strip load-bearing complexity) and the
   alternatives or simplifications the panel surfaced (Green).
4. 🔵 **Blue (decide).** Apply the approval rule:
   - no unresolved **critical** finding;
   - no unresolved **high-severity** financial, security, invariant, graph, or loop finding;
   - **every mandatory correctness reviewer approves.**

   **Majority voting cannot override a correctness proof failure.** Three approvals do not clear a
   failing invariant test. If the gate fails, remediate (often via `/code-simplify`) and re-run.
5. **Write `.ai/specs/03-review.md`:** the verdict table, the hat summary, per-finding disposition
   (`✅ FIXED` now vs `📋 DEFERRED` to `98-nice-to-haves.md` with rationale), evidence (gate-command
   output), and the next step.

## Notes

- **Verify reviewer claims against ground truth before acting on them.** A reviewer is a
  perspective, not an oracle; several have confidently recommended deleting load-bearing code. Where
  a claim is checkable, check it — do not accept it on majority opinion.
- **A reviewer's approval is not test evidence.** It never substitutes for pasted output.
- Use the fan-out here and for genuinely independent work — not for trivial diffs.
- Each reviewer is read-only; the lead applies fixes and re-runs the integrated checks.
- For the full hat method (sequence, AI adaptations, graceful degradation), see the
  `six-thinking-hats` skill.
