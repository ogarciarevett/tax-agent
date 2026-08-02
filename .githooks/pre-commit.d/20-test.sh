#!/usr/bin/env sh
# Run the test suite + coverage gate BEFORE the commit (blocks on failure).
#
# The post-commit twin (post-commit.d/10-test.sh) can only report — git ignores its exit status —
# so without this hook the Definition of Done's "coverage >= 80%" was a claim nothing could enforce.
# A pipeline whose central rule is "no ✅ without evidence" cannot have an advisory evidence gate.
#
# Skips ONLY before the project is scaffolded (no package.json). After that it fails closed.
set -eu
[ -f package.json ] || exit 0   # pre-scaffold repo: nothing to test yet
# Once package.json exists, a MISSING toolchain is a failure, not a skip. Exiting 0 here would let
# the only blocking evidence gate pass on any machine without pnpm.
if ! command -v pnpm >/dev/null 2>&1; then
	echo "✗ pre-commit: pnpm not found, but package.json exists — cannot run the test gate." >&2
	exit 1
fi
if ! node -e 'const s=require("./package.json").scripts;process.exit(s&&s.test?0:1)' 2>/dev/null; then
	echo "✗ pre-commit: package.json has no \"test\" script — the coverage gate cannot run." >&2
	exit 1
fi
# NOTE: this tests the WORKING TREE, not the staged index. A partially-staged commit can therefore
# be tested against different content than it commits. Testing an isolated index snapshot is
# recorded in .ai/specs/98-nice-to-haves.md; CI is the real fix.
pnpm test

# Task-graph machinery: validate every committed graph and prove the validator itself still works.
if [ -f scripts/validate-task-graph.mjs ]; then
	node scripts/validate-task-graph.test.mjs >/dev/null
	for g in .ai/specs/task-graphs/*.json; do
		[ -e "$g" ] || continue
		node scripts/validate-task-graph.mjs "$g" >/dev/null
	done
fi
