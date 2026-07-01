#!/usr/bin/env sh
# Format + lint staged JS/TS/JSON via Biome (blocks the commit on error).
# ponytail: skips silently until the app is scaffolded (no package.json) or nothing relevant is
# staged, so it never blocks infra/docs-only commits.
set -eu
[ -f package.json ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
staged=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.json' '*.jsonc')
[ -n "$staged" ] || exit 0
# shellcheck disable=SC2086  # deliberate word-split: pass each staged file as its own arg.
pnpm exec biome check $staged
