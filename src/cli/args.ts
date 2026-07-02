import { z } from "zod";

// Calendar month as used for bill grouping and the report view.
export const MonthSchema = z
	.string()
	.regex(
		/^\d{4}-(0[1-9]|1[0-2])$/,
		"Expected a month as YYYY-MM (e.g. 2026-07).",
	);

export type CliCommand =
	| { kind: "interview" }
	| { kind: "scan" }
	| { kind: "report"; month: string }
	| { kind: "help"; error?: string };

/** Format a Date as YYYY-MM (local time — bills group by the user's calendar). */
export function currentMonth(now: Date): string {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Pure argv parser — `now` is injected so the report default month is testable.
 * ponytail: a switch over argv[0]; a CLI framework buys nothing at four commands.
 */
export function parseCliArgs(
	argv: readonly string[],
	now: Date = new Date(),
): CliCommand {
	const [cmd, ...rest] = argv;
	switch (cmd) {
		case undefined:
		case "interview":
			return { kind: "interview" };
		case "scan":
			return { kind: "scan" };
		case "report": {
			const flagIndex = rest.indexOf("--month");
			if (flagIndex === -1) {
				return { kind: "report", month: currentMonth(now) };
			}
			const raw = rest[flagIndex + 1] ?? "";
			const parsed = MonthSchema.safeParse(raw);
			if (!parsed.success) {
				return {
					kind: "help",
					error:
						`Invalid --month "${raw}". ${parsed.error.issues[0]?.message ?? ""}`.trim(),
				};
			}
			return { kind: "report", month: parsed.data };
		}
		case "help":
		case "--help":
		case "-h":
			return { kind: "help" };
		default:
			return { kind: "help", error: `Unknown command "${cmd}".` };
	}
}

export function usage(): string {
	return [
		"Usage: tax-agent <command>",
		"",
		"  interview                 (default) run the profile interview",
		"  scan                      check email for new bills and store them",
		"  report [--month YYYY-MM]  show the monthly bill + tax table (default: current month)",
		"  help                      show this message",
	].join("\n");
}
