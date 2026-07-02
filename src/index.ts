import { parseCliArgs, usage } from "./cli/args";
import { runInterviewCommand } from "./cli/interview";
import { runReportCommand } from "./cli/report";
import { runScanCommand } from "./cli/scan";

// CLI entry: a thin router. All behavior lives in one file per command under src/cli/ so
// parallel tasks never edit this file (frozen after B0).
async function main(): Promise<void> {
	const cmd = parseCliArgs(process.argv.slice(2));
	switch (cmd.kind) {
		case "interview":
			await runInterviewCommand();
			return;
		case "scan":
			process.exitCode = await runScanCommand();
			return;
		case "report":
			await runReportCommand(cmd.month);
			return;
		case "help":
			if (cmd.error) {
				console.error(cmd.error);
				console.error(usage());
				process.exitCode = 2;
			} else {
				console.log(usage());
			}
			return;
	}
}

main().catch((err: unknown) => {
	// Generic message so profile/bill PII can never ride out in an error string; detail behind DEBUG.
	console.error("Something went wrong. Re-run with DEBUG=1 for details.");
	if (process.env.DEBUG) {
		console.error(err);
	}
	process.exitCode = 1;
});
