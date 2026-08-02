#!/usr/bin/env sh
# Typecheck the whole project (tsc is project-wide, not per-file).
# ponytail: skips until a tsconfig exists so it never blocks the bootstrap commit.
set -eu
[ -f tsconfig.json ] || exit 0
# Fail closed: the Definition of Done claims this gate is clean, so a missing toolchain must
# block rather than silently pass. (Matches 20-test.sh; flagged by the P1 security audit.)
if ! command -v pnpm >/dev/null 2>&1; then
	echo "✗ pre-commit: pnpm not found, but package.json/tsconfig.json exists — cannot run the tsc gate." >&2
	exit 1
fi
pnpm exec tsc --noEmit
