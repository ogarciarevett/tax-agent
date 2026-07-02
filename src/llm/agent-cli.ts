import { execFile } from "node:child_process";
import type { Writable } from "node:stream";
import { z } from "zod";
import type { AgentRunner } from "../domain/agent";

/**
 * The subscription bridge: spawn the user's local agent CLI (`claude -p` / `codex exec`) and return
 * its text reply. No API keys, no provider SDKs — LLM access is only ever a subprocess of a CLI the
 * user already pays for (see .ai/context.md hard rules).
 *
 * PII discipline: the prompt goes on the child's STDIN, never argv, so tax content never shows up in
 * `ps`; errors carry only an exit code + a truncated stderr excerpt — never the prompt. Model/effort
 * flags differ per CLI and are omitted when unset, so the CLI's own default wins.
 */

// 5 min: an agent turn that reads Gmail + reasons can be slow; a cron run should not hang forever.
// 10 min: one live batch (Gmail search + ~8 thread reads + JSON generation) measured over 5 min.
const DEFAULT_TIMEOUT_MS = 600_000;
// ponytail: 10 MB reply ceiling — bump if a report ever needs a larger single CLI response.
const MAX_BUFFER = 10 * 1024 * 1024;

const DEFAULT_BINS = { claude: "claude", codex: "codex" } as const;

/**
 * Least-privilege Gmail allowlist passed to `claude --allowedTools`: read-only search + fetch.
 * Label/draft/mutation tools are deliberately omitted — the scan only ever READS mail.
 */
export const GMAIL_READ_TOOLS = [
	"mcp__claude_ai_Gmail__search_threads",
	"mcp__claude_ai_Gmail__get_thread",
	"mcp__claude_ai_Gmail__list_labels",
] as const;

const NOT_FOUND_HINTS: Record<Provider, string> = {
	claude:
		'install the "claude" CLI or set TAX_AGENT_LLM_BIN to its absolute path',
	codex:
		'install the "codex" CLI, or configure a Gmail MCP for codex or use TAX_AGENT_LLM=claude',
};

const ProviderSchema = z.enum(["claude", "codex"]);
export type Provider = z.infer<typeof ProviderSchema>;

// Env is untrusted input → validated at this boundary. Optional flags stay undefined when unset.
const EnvSchema = z.object({
	TAX_AGENT_LLM: ProviderSchema.default("claude"),
	TAX_AGENT_LLM_MODEL: z.string().min(1).optional(),
	TAX_AGENT_LLM_EFFORT: z.string().min(1).optional(),
	TAX_AGENT_LLM_BIN: z.string().min(1).optional(),
	// A real Gmail batch (search + read threads + emit JSON) can exceed 5 minutes.
	TAX_AGENT_LLM_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.max(3_600_000)
		.optional(),
});
export type AgentEnv = z.infer<typeof EnvSchema>;

/** Thrown when the agent CLI env config is invalid (e.g. an unknown provider). */
export class AgentEnvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AgentEnvError";
	}
}

/** Thrown when the CLI binary cannot be found (ENOENT); message carries a provider-specific hint. */
export class AgentCliNotFoundError extends Error {
	constructor(
		readonly provider: Provider,
		readonly bin: string,
	) {
		super(`${provider} CLI "${bin}" not found — ${NOT_FOUND_HINTS[provider]}.`);
		this.name = "AgentCliNotFoundError";
	}
}

/**
 * Thrown on a non-zero exit. The MESSAGE carries only provider + exit code (it may end up in the
 * cron log); the stderr excerpt rides as a property, surfaced only under DEBUG.
 */
export class AgentCliFailedError extends Error {
	constructor(
		readonly provider: Provider,
		readonly code: number,
		readonly stderrExcerpt: string,
	) {
		super(`${provider} CLI exited with code ${code}`);
		this.name = "AgentCliFailedError";
	}
}

/** Thrown when the CLI is killed after exceeding the timeout. */
export class AgentCliTimeoutError extends Error {
	constructor(
		readonly provider: Provider,
		readonly timeoutMs: number,
	) {
		super(`${provider} CLI timed out after ${timeoutMs}ms`);
		this.name = "AgentCliTimeoutError";
	}
}

// Only the fields we branch on: `code` is "ENOENT" | exit number, `killed` is set on timeout.
interface ExecFileErrorLike {
	code?: string | number | null;
	killed?: boolean;
}

/** Injectable spawn seam — the real `execFile` in prod, a fake in tests (same pattern as Prompter). */
export type ExecFileLike = (
	file: string,
	args: readonly string[],
	options: { timeout: number; maxBuffer: number; encoding: "utf8" },
	callback: (
		e: ExecFileErrorLike | null,
		stdout: string,
		stderr: string,
	) => void,
) => { stdin: Writable | null };

const nodeExecFile: ExecFileLike = (file, args, options, callback) =>
	execFile(file, args, options, callback);

export interface AgentCliOptions {
	/** Defaults to `process.env`. Injected in tests to exercise provider/model/effort matrices. */
	env?: NodeJS.ProcessEnv;
	/** Defaults to node's `execFile`. Injected in tests to assert argv/stdin/timeout. */
	execFileImpl?: ExecFileLike;
	/** Defaults to TAX_AGENT_LLM_TIMEOUT_MS, else 600_000ms. */
	timeoutMs?: number;
}

/** Validate the agent CLI env at the boundary, rethrowing a clear message for bad providers. */
export function parseAgentEnv(env: NodeJS.ProcessEnv): AgentEnv {
	const parsed = EnvSchema.safeParse({
		TAX_AGENT_LLM: env.TAX_AGENT_LLM,
		TAX_AGENT_LLM_MODEL: env.TAX_AGENT_LLM_MODEL,
		TAX_AGENT_LLM_EFFORT: env.TAX_AGENT_LLM_EFFORT,
		TAX_AGENT_LLM_BIN: env.TAX_AGENT_LLM_BIN,
		TAX_AGENT_LLM_TIMEOUT_MS: env.TAX_AGENT_LLM_TIMEOUT_MS,
	});
	if (parsed.success) {
		return parsed.data;
	}
	const issue = parsed.error.issues[0];
	if (issue?.path[0] === "TAX_AGENT_LLM") {
		throw new AgentEnvError(
			`TAX_AGENT_LLM must be "claude" or "codex" (got "${String(env.TAX_AGENT_LLM)}").`,
		);
	}
	throw new AgentEnvError(
		`Invalid agent CLI config: ${issue?.message ?? "unknown error"}`,
	);
}

function buildClaudeArgs(env: AgentEnv): string[] {
	const args = ["-p", "--output-format", "text"];
	if (env.TAX_AGENT_LLM_MODEL) {
		args.push("--model", env.TAX_AGENT_LLM_MODEL);
	}
	if (env.TAX_AGENT_LLM_EFFORT) {
		args.push("--effort", env.TAX_AGENT_LLM_EFFORT);
	}
	args.push("--allowedTools", ...GMAIL_READ_TOOLS);
	return args;
}

function buildCodexArgs(env: AgentEnv): string[] {
	const args = ["exec"];
	if (env.TAX_AGENT_LLM_MODEL) {
		args.push("-m", env.TAX_AGENT_LLM_MODEL);
	}
	if (env.TAX_AGENT_LLM_EFFORT) {
		args.push("-c", `model_reasoning_effort=${env.TAX_AGENT_LLM_EFFORT}`);
	}
	// Least-privilege parity with claude's --allowedTools: bill emails are untrusted content, so
	// the codex session must not be able to write files or run commands with what it reads.
	args.push("--sandbox", "read-only");
	args.push("-"); // read the prompt from stdin (never argv)
	return args;
}

function buildArgs(env: AgentEnv): string[] {
	return env.TAX_AGENT_LLM === "claude"
		? buildClaudeArgs(env)
		: buildCodexArgs(env);
}

function toTypedError(
	error: ExecFileErrorLike,
	stderr: string,
	provider: Provider,
	bin: string,
	timeoutMs: number,
): Error {
	if (error.code === "ENOENT") {
		return new AgentCliNotFoundError(provider, bin);
	}
	if (error.killed) {
		return new AgentCliTimeoutError(provider, timeoutMs);
	}
	const code = typeof error.code === "number" ? error.code : -1;
	return new AgentCliFailedError(provider, code, stderr.slice(0, 200));
}

/**
 * The seam to the user's subscription agent CLI. Provider swap is config-only: same call site,
 * `TAX_AGENT_LLM=codex` changes only the argv.
 */
export function createAgentCli(opts: AgentCliOptions = {}): AgentRunner {
	const env = parseAgentEnv(opts.env ?? process.env);
	const execFileImpl = opts.execFileImpl ?? nodeExecFile;
	const timeoutMs =
		opts.timeoutMs ?? env.TAX_AGENT_LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
	const provider = env.TAX_AGENT_LLM;
	const bin = env.TAX_AGENT_LLM_BIN ?? DEFAULT_BINS[provider];
	const args = buildArgs(env);

	return {
		run(prompt: string): Promise<string> {
			return new Promise<string>((resolve, reject) => {
				const child = execFileImpl(
					bin,
					args,
					{ timeout: timeoutMs, maxBuffer: MAX_BUFFER, encoding: "utf8" },
					(error, stdout, stderr) => {
						if (error) {
							reject(toTypedError(error, stderr, provider, bin, timeoutMs));
							return;
						}
						resolve(stdout.trim());
					},
				);
				const { stdin } = child;
				if (stdin) {
					// Swallow EPIPE if the child exits before reading — the callback owns the real error.
					stdin.on("error", () => {});
					stdin.end(prompt);
				}
			});
		},
	};
}
