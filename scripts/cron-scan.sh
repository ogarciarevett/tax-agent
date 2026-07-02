#!/bin/sh
# tax-agent — daily bill scan, invoked by the user's crontab (see README "Daily bill scan via cron").
# cron runs with an almost-empty environment, so we pin PATH to where node and the agent CLIs live
# before exec'ing the scan:
#   - the nvm node bin that better-sqlite3 was built against (also holds the `claude` CLI)
#   - ~/.bun/bin (the `codex` CLI)
#   - /opt/homebrew/bin (Homebrew tools)
# The node version is pinned so the native better-sqlite3 ABI always matches — bump it here after an
# `nvm install` + `pnpm rebuild better-sqlite3`. We NEVER touch the user's crontab (manual install).
set -eu

export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$HOME/.bun/bin:/opt/homebrew/bin:$PATH"

cd "$(dirname "$0")/.." || exit 1
mkdir -p data/logs && chmod 700 data/logs

# tsx runs the TypeScript entry directly (no build step). The scan's exit code propagates to cron's
# log: 0 clean · 2 completed-with-failures · 1 fatal.
exec node node_modules/tsx/dist/cli.mjs src/index.ts scan
