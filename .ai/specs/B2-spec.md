# B2 — Agent-CLI adapter (claude/codex, model+effort)  (per-task spec)

- Task id: B2
- Status: **APPROVED**
- Backlog source: local (.ai/specs)
- Traces up to: [`01-spec.md`](./01-spec.md)  ·  Indexed in: [`02-plan.md`](./02-plan.md)
- Epic: B

## Goal
The subscription bridge: `createAgentCli(opts): AgentRunner` spawns the user's local agent CLI
(`claude -p` or `codex exec`) with model/effort config, prompt on stdin, and returns its text
reply. No API keys, no provider SDKs — the contract's LLM hard rule, and the user's architecture
directive ("reuse my claude OR codex subscription; must work for both").

## Scope / non-goals
**In scope**
- `src/llm/agent-cli.ts` — `execFile` (no shell → no injection), prompt written to **stdin**
  (nothing PII-bearing in argv/ps), default timeout 300s, kill on expiry.
- Provider matrix (flags MUST be verified against the real CLIs before coding, then pinned here):
  - `claude`: `-p` + `--model <model>` + a Gmail-read `--allowedTools` allowlist (least privilege).
  - `codex`: `exec -m <model> -c model_reasoning_effort=<effort>` (prompt on stdin via `-`).
- Env config, zod-validated at the boundary: `TAX_AGENT_LLM` (`claude|codex`, default `claude`),
  `TAX_AGENT_LLM_MODEL`, `TAX_AGENT_LLM_EFFORT`, `TAX_AGENT_LLM_BIN` (absolute path for cron).
- Typed errors: `AgentCliNotFoundError` (ENOENT → provider-specific install/config hint),
  `AgentCliFailedError` (non-zero exit, stderr excerpt sanitized), `AgentCliTimeoutError`.

**Non-goals** — no prompt content (B3), no orchestration (B5), no retry policy (B3 owns it).

## Acceptance criteria
- [ ] 1. Unit tests with an injected fake `execFile`: exact argv per provider/model/effort; stdin
      receives the prompt; timeout kills and rejects typed; ENOENT / non-zero exit → typed errors.
- [ ] 2. Provider swap is config-only: same call site, `TAX_AGENT_LLM=codex` changes only argv
      (asserted in tests) — the contract's LLM-agnostic acceptance seed.
- [ ] 3. Env schema rejects unknown provider values with a clear message (unit test).
- [ ] 4. One real smoke run `echo`-style prompt through the actual `claude` CLI (manual evidence,
      pasted) — proves the flag set is real, not guessed.
- [ ] 5. Gates green: `tsc` · `biome` · coverage ≥ 80% (pasted).

## Interfaces / data touched
`src/llm/agent-cli.ts`(+test). Consumes `AgentRunner` from `src/domain/agent.ts` (frozen, B1).

## Risks & assumptions
- Effort flag support differs per CLI/version — pin what the installed versions actually accept;
  omit the flag when a CLI has none (documented in the module header).
- Headless MCP availability is proven separately in B7's live E2E; this task only shapes the spawn.
