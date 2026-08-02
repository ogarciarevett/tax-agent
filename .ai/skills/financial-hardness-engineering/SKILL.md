---
name: financial-hardness-engineering
description: Make completion gates hard and false verification impossible — evidence that cannot be faked, gates that can actually fail, financial correctness constraints, security and tenancy boundaries, and anti-overclaim discipline. Use when defining a Definition of Done, auditing whether a gate can fire, reviewing an acceptance report, or whenever a ✅ is about to be written.
---

# Financial Hardness Engineering

Hardness is the property that **the system cannot claim something it has not proven**. An LLM's
default failure mode is confident over-reporting; a soft gate turns that failure mode into shipped
incorrect money software.

**The thesis:** a gate that cannot fail is not a gate. Before trusting any ✅, ask what would have
had to happen for it to be ❌ — and whether that path actually exists.

## When to Use

- Defining or changing a Definition of Done
- Auditing whether a declared gate can actually fail
- Reviewing an acceptance report or an Honest Implementation Report
- Designing evidence requirements for a financially material change
- Any time a ✅ is about to be written

**When NOT to use:** exploratory spikes explicitly labelled as throwaway. Say they are throwaway;
do not quietly apply soft standards to work that will ship.

## Non-goals

- **Not process for its own sake.** Every gate must have a failure it plausibly catches.
- **Not a substitute for review.** Hardness makes claims checkable; humans still judge.
- **Not a guarantee of correctness.** It guarantees that *unproven* is never reported as *proven*.

## Required inputs

| Input | Why |
|---|---|
| The acceptance criteria, each testable | an untestable criterion cannot be hardened |
| The exact gate commands | "run the tests" cannot be pasted as evidence |
| The failure path of every gate | a gate whose failure path is untested is decorative |
| The financial correctness constraints (`.ai/context.md`) | they are the non-negotiables |
| The tenancy and security boundary for the change | the negative case is the test that matters |

## Terminology

- **Hard gate** — blocks the pipeline on failure. **Soft gate** — reports and continues.
- **Evidence** — files, diffs, and pasted command output. Nothing else.
- **False verification** — a ✅ whose proof does not exist or does not prove the claim.
- **Unexplained scope** — a change no requirement or invariant asked for.
- **Honest Implementation Metric** — verified ✅ criteria ÷ total criteria.
- **Under-claiming** — reporting ⚠️/❌/🚫 with a reason. Correct and expected.

## Procedure

### 1. Enumerate every gate and classify it hard or soft
Write them down. For each, name the command and where it runs (pre-commit, CI, manual).

### 2. Prove each hard gate can fail
This is the step everyone skips. Break something deliberately and watch the gate block. A gate you
have never seen fail is a gate you are trusting on faith.

> Real example from this repository: the Definition of Done required "coverage ≥ 80%", but the only
> test run was `post-commit`, whose script ended `pnpm test || echo "⚠ …"; exit 0`, and git ignores
> post-commit exit status anyway. With no CI, **nothing could ever fail on tests.** The claim had
> been in the contract for months. The fix was a ten-line pre-commit hook.

### 3. Make evidence *required and structured* — and know what that does NOT buy you
Prefer gates that produce output only when actually run: a non-zero exit code, a test count, a diff.
Prefer machine checks over prose review for anything mechanically checkable.

**Be precise about the guarantee.** Requiring an `evidence[]` entry with a criterion, a command, and
an output excerpt is *structural* — a tool can reject its absence, and this repo's validator does.
It is **not** verification: nothing re-executes the command or diffs the recorded output against a
fresh run, so plausible text passes. Every node in this repo's own P1 graph rests on that weaker
guarantee. Say "required and structured", never "unfakeable" — overstating the mechanism is itself
the *Evidence theater* failure mode listed below. Closing the gap means storing a command plus exit
code and hash and re-running it in the gate; until that exists, the residual risk is named in the
review record rather than papered over.

### 4. Assert the negative for every boundary
For tenancy, authorization, and validation: test that the forbidden thing is **refused**. A passing
positive case proves the feature works, not that the boundary holds.

### 5. Attach evidence at the moment of proof
Evidence collected later is reconstruction. Paste it when the command runs, into the node's
`evidence[]` and the report.

### 6. Report honestly, then improve the number
Under-claim freely. The Honest Implementation Metric is graded on honesty, not on being high. A 60%
with accurate rows is worth more than a 100% with three invented ones.

## State transitions

Hardness governs the entry into `VERIFIED` and nothing else — but it governs it absolutely.

| Transition | Hard requirement |
|---|---|
| `IMPLEMENTING → TESTED` | pasted GREEN output, not "tests pass" |
| `TESTED → REVIEWED` | findings with `file:line`; a reviewer's approval is **not** test evidence |
| `REVIEWED → RECONCILED` | `--reconcile` shows no unexplained scope |
| `RECONCILED → VERIFIED` | every acceptance criterion has pasted evidence; the validator rejects an evidence-free `VERIFIED` |
| any → `VERIFIED` | **there is no other path.** No state may be skipped |

## Graph impact

Hardness is enforcement of graph 4 (evidence). It requires that every requirement has a complete
path — `requirement → behavior → implementation → test → passing evidence` — and that no
implementation exists without a requirement or invariant pointing at it. It touches graph 2 by
rejecting `VERIFIED` nodes with empty `evidence`.

## Invariants

1. **No ✅ without pasted evidence.** A status without proof is at most ⚠️.
2. **Every hard gate has been observed failing** at least once.
3. **Reviewer opinion is never test evidence.**
4. **Agent, pane, or task status (`idle`, `done`, `unknown`) is never evidence.**
5. **Every boundary has a negative test.**
6. **No unexplained scope reaches `VERIFIED`.**
7. **No state is skipped on the path to `VERIFIED`.**
8. **The Unverified and Could-not-do lists are never omitted** — "none" is a valid entry; silence is
   not.
9. **All fourteen financial correctness constraints hold** for financially material work
   (`.ai/context.md`).
10. **Under-claiming is always safe; over-claiming is a contract violation.**

## Mandatory tests

- **Gate failure tests** — deliberately break each gate's precondition; assert it blocks. Run this
  when a gate is added or changed.
- **Negative boundary tests** — unauthorized read refused; cross-tenant access refused; invalid
  input rejected at the Zod boundary.
- **Money property tests** — integer minor units end to end, currency preserved, rounding applied
  exactly once, no floating-point path.
- **Provenance tests** — every emitted figure resolves to a document id or rule id.
- **Evidence-integrity test** — the task-graph validator rejects a `VERIFIED` node with empty
  evidence (`node scripts/validate-task-graph.test.mjs`).
- **Unexplained-scope test** — `--reconcile` flags a file outside every write set.

## Evidence requirements

For each gate: the command, its exit status, and enough output to identify what ran (test counts,
file names). For each boundary: the refusal, shown. For the report: the metric, the two lists, and
the bootstrap exceptions if any.

Never paste output you did not produce. Never summarize a run you did not execute. If a command
could not be run here, that belongs in **Could-not-do**, stated plainly.

## Failure modes

| Failure mode | What it looks like | Why it is dangerous |
|---|---|---|
| **Advisory gate** | failure logged, exit 0 | the contract claims enforcement that cannot fire |
| **Untested failure path** | gate never observed blocking | it may be broken and nobody would know |
| **Evidence theater** | plausible-looking output that was never run | indistinguishable from real evidence until it matters |
| **Reviewer laundering** | "code-reviewer approved" cited as proof of correctness | opinion promoted to evidence |
| **Status laundering** | agent reported `done`, so the work is recorded verified | process state promoted to correctness |
| **Positive-only testing** | boundary tested by confirming the allowed case works | proves nothing about the boundary |
| **Metric inflation** | ⚠️ rounded up to ✅ to reach 100% | the exact behavior the honesty protocol exists to prevent |
| **Silent omission** | Unverified list dropped because it was empty-ish | the reader cannot distinguish "none" from "not checked" |
| **Retro-widened scope** | write set edited so `--reconcile` passes | falsifying the evidence rather than fixing the work |

## Recovery

- **Gate found to be advisory** → make it hard, then re-verify everything it was supposed to have
  gated. Prior ✅ rows that depended on it are downgraded to ⚠️ until re-proven.
- **False ✅ discovered** → correct the row, state what the evidence actually showed, and check
  whether the same pattern produced other rows. One fabricated row is rarely alone.
- **Evidence cannot be produced here** (no network, no creds, needs a TTY) → mark 🚫 or ⚠️ with the
  precise reason. This is the correct outcome, not a failure of the work.
- **Unexplained scope found** → revert it or amend the spec and re-approve. Never widen the write
  set to silence the check.
- **A constraint was violated in shipped code** → treat as a correctness proof failure: it blocks
  release regardless of how many reviewers approved.

## Output format

```markdown
## Hardness audit — <scope>

### Gates
| Gate | Command | Hard/Soft | Where it runs | Observed failing? | Evidence |
|------|---------|-----------|---------------|-------------------|----------|

### Boundaries
| Boundary | Negative test | Result |
|----------|---------------|--------|

### Honest Implementation Report
| # | Criterion | Status | Evidence (pasted) |
|---|-----------|--------|-------------------|

**Honest Implementation Metric:** verified ✅ / total = NN%

**Unverified:** <or "none">
**Could-not-do:** <or "none">
**Bootstrap exceptions:** <or "none">
```

## Worked example

A node claims: *"AC2 — cross-household access is prevented."*

**Soft version (rejected):** status ✅, evidence *"authorization filter added in the repository
layer; security-auditor approved."* Two problems — the filter's presence is not proof it works, and
the reviewer's approval is opinion, not a test.

**Hard version (accepted):**

1. Write the negative test first: household B's user requests household A's account; assert the call
   is refused and returns no rows.
2. Run it against the code **before** the filter exists. Paste the failure — this proves the test can
   fail, which is what makes its later pass meaningful.
3. Add the filter. Run again. Paste the pass, with the test name and count.
4. Record `evidence: [{criterion: "AC2", command: "pnpm test …isolation", output_excerpt: "…1 passed…"}]`.
5. Only now is AC2 ✅.

The difference between the two versions is not effort. It is whether a ❌ was ever reachable.

## Integration with pipeline commands

| Command | How this skill applies |
|---|---|
| `/spec` | acceptance criteria must be testable; boundaries get negative cases |
| `/plan` | every node carries literal verification commands |
| `/build` | RED failure pasted; ✅ only with evidence; the Honest Implementation Report |
| `/test` | negative boundary suites, property tests on money, the coverage gate |
| `/review` | checks that claims are backed, not merely plausible |
| `/consensus-review` | majority cannot override a correctness proof failure |
| `/reconcile` | unexplained scope blocks `VERIFIED` |
| `/acceptance` | the evidence graph; no status upgraded at roll-up |
| `/ship` | preconditions verified, not assumed |

## Integration with /evolve

`/evolve` audits hardness itself: which gates exist, which are hard, which have ever been observed
failing, whether the Definition of Done claims enforcement the repository cannot perform, and
whether any `VERIFIED` node's evidence still resolves. A contract that promises a gate the tooling
does not implement is a drift finding of the highest severity. Proposals go to
`.ai/specs/97-evolution.md`, never applied silently.
