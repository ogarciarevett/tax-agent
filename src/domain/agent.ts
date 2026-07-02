/**
 * The seam to the user's subscription agent CLI (`claude -p` / `codex exec`). One method so the
 * orchestrator, prompts, and tests never care which CLI is behind it (same pattern as `Prompter`).
 * Implemented by src/llm/agent-cli.ts and by test fakes.
 */
export interface AgentRunner {
	run(prompt: string): Promise<string>;
}
