#!/usr/bin/env sh
# Format + lint staged JS/TS/JSON via Biome (blocks the commit on error).
# ponytail: skips silently until the app is scaffolded (no package.json) or nothing relevant is
# staged, so it never blocks infra/docs-only commits.
set -eu
[ -f package.json ] || exit 0
# Fail closed: the Definition of Done claims this gate is clean, so a missing toolchain must
# block rather than silently pass. (Matches 20-test.sh; flagged by the P1 security audit.)
if ! command -v pnpm >/dev/null 2>&1; then
	echo "✗ pre-commit: pnpm not found, but package.json/tsconfig.json exists — cannot run the biome gate." >&2
	exit 1
fi
staged=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.json' '*.jsonc')
[ -n "$staged" ] || exit 0
# shellcheck disable=SC2086  # deliberate word-split: pass each staged file as its own arg.
pnpm exec biome check $staged
