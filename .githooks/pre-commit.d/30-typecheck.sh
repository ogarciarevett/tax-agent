#!/usr/bin/env sh
# Typecheck the whole project (tsc is project-wide, not per-file).
# ponytail: skips until a tsconfig exists so it never blocks the bootstrap commit.
set -eu
[ -f tsconfig.json ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
pnpm exec tsc --noEmit
