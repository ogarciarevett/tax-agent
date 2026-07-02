import type { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
	AgentCliFailedError,
	AgentCliNotFoundError,
	AgentCliTimeoutError,
	AgentEnvError,
	createAgentCli,
	type ExecFileLike,
	GMAIL_READ_TOOLS,
	parseAgentEnv,
} from "./agent-cli";

interface Call {
	file: string;
	args: string[];
	timeout: number;
	stdin: string;
}

// Reuse the real callback signature so the fake can't drift from the injected seam's type.
type Outcome = (cb: Parameters<ExecFileLike>[3]) => void;

/** A fake `execFile`: records file/argv/timeout + what was written to stdin, then fires `outcome`. */
function fakeExec(outcome: Outcome): { impl: ExecFileLike; calls: Call[] } {
	const calls: Call[] = [];
	const impl: ExecFileLike = (file, args, options, callback) => {
		const call: Call = {
			file,
			args: [...args],
			timeout: options.timeout,
			stdin: "",
		};
		calls.push(call);
		outcome(callback);
		const stdin = {
			on: () => stdin,
			end: (chunk?: string) => {
				if (typeof chunk === "string") {
					call.stdin = chunk;
				}
			},
		};
		return { stdin: stdin as unknown as Writable };
	};
	return { impl, calls };
}

const ok: Outcome = (cb) => cb(null, "  hello world  ", "");

describe("createAgentCli — claude argv", () => {
	it("omits --model/--effort when unset and passes the Gmail read allowlist", async () => {
		const { impl, calls } = fakeExec(ok);
		await createAgentCli({ env: {}, execFileImpl: impl }).run("q");
		expect(calls[0]?.file).toBe("claude");
		expect(calls[0]?.args).toEqual([
			"-p",
			"--output-format",
			"text",
			"--allowedTools",
			...GMAIL_READ_TOOLS,
		]);
	});

	it("adds --model and --effort when the env sets them", async () => {
		const { impl, calls } = fakeExec(ok);
		await createAgentCli({
			env: { TAX_AGENT_LLM_MODEL: "opus", TAX_AGENT_LLM_EFFORT: "high" },
			execFileImpl: impl,
		}).run("q");
		expect(calls[0]?.args).toEqual([
			"-p",
			"--output-format",
			"text",
			"--model",
			"opus",
			"--effort",
			"high",
			"--allowedTools",
			...GMAIL_READ_TOOLS,
		]);
	});

	it("never mutates or exposes label/draft Gmail tools", () => {
		expect(GMAIL_READ_TOOLS).toEqual([
			"mcp__claude_ai_Gmail__search_threads",
			"mcp__claude_ai_Gmail__get_thread",
			"mcp__claude_ai_Gmail__list_labels",
		]);
	});
});

describe("createAgentCli — codex argv", () => {
	it("uses `exec -` and omits model/effort when unset", async () => {
		const { impl, calls } = fakeExec(ok);
		await createAgentCli({
			env: { TAX_AGENT_LLM: "codex" },
			execFileImpl: impl,
		}).run("q");
		expect(calls[0]?.file).toBe("codex");
		expect(calls[0]?.args).toEqual(["exec", "--sandbox", "read-only", "-"]);
	});

	it("adds -m and -c model_reasoning_effort when the env sets them", async () => {
		const { impl, calls } = fakeExec(ok);
		await createAgentCli({
			env: {
				TAX_AGENT_LLM: "codex",
				TAX_AGENT_LLM_MODEL: "o3",
				TAX_AGENT_LLM_EFFORT: "high",
			},
			execFileImpl: impl,
		}).run("q");
		expect(calls[0]?.args).toEqual([
			"exec",
			"-m",
			"o3",
			"-c",
			"model_reasoning_effort=high",
			"--sandbox",
			"read-only",
			"-",
		]);
	});
});

describe("createAgentCli — provider swap is config-only (AC#2)", () => {
	it("changes only argv/binary for the same call site", async () => {
		const claude = fakeExec(ok);
		const codex = fakeExec(ok);
		await createAgentCli({ env: {}, execFileImpl: claude.impl }).run("same");
		await createAgentCli({
			env: { TAX_AGENT_LLM: "codex" },
			execFileImpl: codex.impl,
		}).run("same");
		expect(claude.calls[0]?.file).toBe("claude");
		expect(codex.calls[0]?.file).toBe("codex");
		expect(claude.calls[0]?.args).not.toEqual(codex.calls[0]?.args);
		expect(claude.calls[0]?.stdin).toBe("same");
		expect(codex.calls[0]?.stdin).toBe("same");
	});
});

describe("createAgentCli — stdin, timeout, bin override", () => {
	it("writes the prompt to stdin, never argv (no PII in ps)", async () => {
		const { impl, calls } = fakeExec(ok);
		const secret = "NIF 12345678Z owed 4200 EUR";
		await createAgentCli({ env: {}, execFileImpl: impl }).run(secret);
		expect(calls[0]?.stdin).toBe(secret);
		expect(calls[0]?.args.join(" ")).not.toContain(secret);
	});

	it("passes the default 600s timeout, overridable via env and opts", async () => {
		const def = fakeExec(ok);
		await createAgentCli({ env: {}, execFileImpl: def.impl }).run("q");
		expect(def.calls[0]?.timeout).toBe(600_000);

		const fromEnv = fakeExec(ok);
		await createAgentCli({
			env: { TAX_AGENT_LLM_TIMEOUT_MS: "120000" },
			execFileImpl: fromEnv.impl,
		}).run("q");
		expect(fromEnv.calls[0]?.timeout).toBe(120_000);

		const custom = fakeExec(ok);
		await createAgentCli({
			env: {},
			execFileImpl: custom.impl,
			timeoutMs: 42,
		}).run("q");
		expect(custom.calls[0]?.timeout).toBe(42);
	});

	it("honors TAX_AGENT_LLM_BIN (cron's bare PATH)", async () => {
		const { impl, calls } = fakeExec(ok);
		await createAgentCli({
			env: { TAX_AGENT_LLM_BIN: "/opt/bin/claude" },
			execFileImpl: impl,
		}).run("q");
		expect(calls[0]?.file).toBe("/opt/bin/claude");
	});

	it("returns the trimmed stdout on success", async () => {
		const { impl } = fakeExec(ok);
		const reply = await createAgentCli({ env: {}, execFileImpl: impl }).run(
			"q",
		);
		expect(reply).toBe("hello world");
	});
});

describe("parseAgentEnv", () => {
	it("defaults to claude when TAX_AGENT_LLM is unset", () => {
		expect(parseAgentEnv({}).TAX_AGENT_LLM).toBe("claude");
	});

	it("rejects an unknown provider with a clear message (AC#3)", () => {
		expect(() => parseAgentEnv({ TAX_AGENT_LLM: "gpt" })).toThrow(
			AgentEnvError,
		);
		expect(() => parseAgentEnv({ TAX_AGENT_LLM: "gpt" })).toThrow(
			/claude.*codex/,
		);
		expect(() => parseAgentEnv({ TAX_AGENT_LLM: "gpt" })).toThrow(/gpt/);
	});

	it("surfaces the same error through createAgentCli", () => {
		expect(() => createAgentCli({ env: { TAX_AGENT_LLM: "gpt" } })).toThrow(
			AgentEnvError,
		);
	});
});

describe("createAgentCli — typed errors", () => {
	it("maps ENOENT to AgentCliNotFoundError with a provider hint (claude)", async () => {
		const { impl } = fakeExec((cb) => cb({ code: "ENOENT" }, "", ""));
		await expect(
			createAgentCli({ env: {}, execFileImpl: impl }).run("q"),
		).rejects.toBeInstanceOf(AgentCliNotFoundError);
		await expect(
			createAgentCli({ env: {}, execFileImpl: impl }).run("q"),
		).rejects.toThrow(/TAX_AGENT_LLM_BIN/);
	});

	it("maps ENOENT for codex to a codex-specific hint", async () => {
		const { impl } = fakeExec((cb) => cb({ code: "ENOENT" }, "", ""));
		await expect(
			createAgentCli({
				env: { TAX_AGENT_LLM: "codex" },
				execFileImpl: impl,
			}).run("q"),
		).rejects.toThrow(/TAX_AGENT_LLM=claude/);
	});

	it("maps a non-zero exit to AgentCliFailedError leaking neither prompt nor stderr", async () => {
		const secret = "NIF 12345678Z";
		const { impl } = fakeExec((cb) => cb({ code: 2 }, "", "auth failed"));
		try {
			await createAgentCli({ env: {}, execFileImpl: impl }).run(secret);
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(AgentCliFailedError);
			expect((error as AgentCliFailedError).code).toBe(2);
			// The MESSAGE may reach the cron log → provider + exit code only; the stderr
			// excerpt rides as a property for DEBUG output.
			expect((error as Error).message).toBe("claude CLI exited with code 2");
			expect((error as AgentCliFailedError).stderrExcerpt).toBe("auth failed");
			expect((error as Error).message).not.toContain(secret);
		}
	});

	it("truncates the stderr excerpt property to 200 chars", async () => {
		const stderr = `${"x".repeat(200)}TAIL_MARKER`;
		const { impl } = fakeExec((cb) => cb({ code: 1 }, "", stderr));
		try {
			await createAgentCli({ env: {}, execFileImpl: impl }).run("q");
			expect.unreachable("should have thrown");
		} catch (error) {
			expect((error as AgentCliFailedError).stderrExcerpt).toHaveLength(200);
			expect((error as AgentCliFailedError).stderrExcerpt).not.toContain(
				"TAIL_MARKER",
			);
		}
	});

	it("maps a timeout kill to AgentCliTimeoutError", async () => {
		const { impl } = fakeExec((cb) => cb({ killed: true, code: null }, "", ""));
		await expect(
			createAgentCli({ env: {}, execFileImpl: impl, timeoutMs: 10 }).run("q"),
		).rejects.toBeInstanceOf(AgentCliTimeoutError);
	});
});

describe("createAgentCli — real CLI smoke (AC#4)", () => {
	// Hits the actual `claude` binary + subscription; opt-in only so CI stays offline/fast.
	// Run once: TAX_AGENT_SMOKE=1 pnpm exec vitest run src/llm -t smoke
	it.skipIf(!process.env.TAX_AGENT_SMOKE)(
		"smoke: claude -p replies to a trivial prompt",
		async () => {
			const reply = await createAgentCli({ env: {} }).run(
				"Reply with exactly: PONG",
			);
			expect(reply).toContain("PONG");
		},
		120_000,
	);
});
