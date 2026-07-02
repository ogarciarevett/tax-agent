import { chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import {
	exitCodeForSummary,
	runScan,
	ScanPreflightError,
} from "../ingest/scan";
import {
	AgentCliFailedError,
	AgentCliNotFoundError,
	AgentCliTimeoutError,
	AgentEnvError,
	createAgentCli,
	parseAgentEnv,
} from "../llm/agent-cli";
import { openDb } from "../storage/db";

/**
 * Daily bill scan (task B5): wire the real deps (SQLite, agent CLI, downloads dir) into `runScan`
 * and map its result to the exit-code contract — 0 clean · 2 completed-with-failures · 1 fatal.
 * This shell is TTY/process-bound and excluded from coverage; all branching logic lives in
 * `src/ingest/scan.ts` (unit-tested). `console.log` is the PII-free line sink (see `ScanLog`).
 */
export async function runScanCommand(): Promise<number> {
	const db = openDb();
	try {
		const summary = await runScan({
			db,
			agent: createAgentCli({ env: process.env }),
			downloadsRoot: resolveDownloadsRoot(process.env),
			extractor: extractorLabel(process.env),
			log: console.log,
		});
		return exitCodeForSummary(summary);
	} catch (error) {
		// Fatal (exit 1): no profile, bad env, or an unresolvable CLI binary. The messages of these
		// typed errors are PII-free by construction; anything else gets a generic line.
		console.error(fatalMessage(error));
		if (process.env.DEBUG) {
			console.error(error);
		}
		return 1;
	} finally {
		db.close();
	}
}

/** The tool label stored on every extracted row for audit (e.g. "claude" or "codex:o4-mini"). */
function extractorLabel(env: NodeJS.ProcessEnv): string {
	const parsed = parseAgentEnv(env);
	return parsed.TAX_AGENT_LLM_MODEL
		? `${parsed.TAX_AGENT_LLM}:${parsed.TAX_AGENT_LLM_MODEL}`
		: parsed.TAX_AGENT_LLM;
}

const DownloadsDirSchema = z
	.string()
	.min(1)
	.refine((p) => isAbsolute(p), {
		message: "TAX_AGENT_DOWNLOADS_DIR must be an absolute path.",
	});

/**
 * Where per-bill Markdown is written. `~/Downloads/tax-agent` by default; set `TAX_AGENT_DOWNLOADS_DIR`
 * (validated absolute) to override — the fallback when macOS denies cron access to `~/Downloads`
 * without a Full Disk Access grant is to point it at the repo-local `data/bills`.
 */
function resolveDownloadsRoot(env: NodeJS.ProcessEnv): string {
	const override = env.TAX_AGENT_DOWNLOADS_DIR;
	if (override !== undefined) {
		const parsed = DownloadsDirSchema.safeParse(override);
		if (!parsed.success) {
			throw new ScanPreflightError(
				parsed.error.issues[0]?.message ?? "Invalid TAX_AGENT_DOWNLOADS_DIR.",
			);
		}
		mkdirSync(parsed.data, { recursive: true, mode: 0o700 });
		chmodSync(parsed.data, 0o700); // mkdir's mode applies only on creation — tighten existing dirs
		return parsed.data;
	}
	const root = join(homedir(), "Downloads", "tax-agent");
	try {
		mkdirSync(root, { recursive: true, mode: 0o700 });
		chmodSync(root, 0o700);
	} catch {
		throw new ScanPreflightError(
			"Cannot write ~/Downloads/tax-agent. Grant Full Disk Access to /usr/sbin/cron, or set " +
				"TAX_AGENT_DOWNLOADS_DIR to an absolute path (e.g. the repo's data/bills).",
		);
	}
	return root;
}

const SAFE_ERRORS = [
	ScanPreflightError,
	AgentEnvError,
	AgentCliNotFoundError,
	AgentCliTimeoutError,
	AgentCliFailedError,
] as const;

function fatalMessage(error: unknown): string {
	if (SAFE_ERRORS.some((cls) => error instanceof cls)) {
		return (error as Error).message;
	}
	return "Scan failed. Re-run with DEBUG=1 for details.";
}
