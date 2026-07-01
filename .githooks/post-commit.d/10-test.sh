#!/usr/bin/env sh
# Run the test suite after commit — reporting only, never blocks (git ignores post-commit status).
# ponytail: skips until package.json has a `test` script; otherwise runs it and surfaces failures.
set -eu
[ -f package.json ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
node -e 'const s=require("./package.json").scripts;process.exit(s&&s.test?0:1)' 2>/dev/null || exit 0
pnpm test || echo "⚠ post-commit: tests failed (see above) — coverage gate is ≥ 80%."
exit 0
