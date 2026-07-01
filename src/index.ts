import { banner } from "./banner";
import { runInterview } from "./interview/interview";
import { openDb } from "./storage/db";
import { loadProfile, saveProfile } from "./storage/profile-repo";
import { OpenTuiPrompter } from "./tui/opentui-prompter";

// CLI entry: load an existing profile (or none), run the opentui interview prefilled with it,
// then persist locally. The interview needs a TTY, so we guard for non-interactive runs. On the
// TTY path the banner/status live inside the TUI (opentui takes the alternate screen), so we only
// print to the normal buffer on the non-interactive path and after the TUI has torn down.
async function main(): Promise<void> {
	const db = openDb();
	const existing = loadProfile(db);

	if (!process.stdin.isTTY) {
		console.log(banner());
		console.log(
			existing
				? `Loaded your profile (${existing.country}, tax year ${existing.taxYear}).`
				: "No profile yet.",
		);
		console.log(
			"The interview needs an interactive terminal. Run `pnpm dev` in your terminal.",
		);
		db.close();
		return;
	}

	const prompter = new OpenTuiPrompter();
	let saved = false;
	try {
		const profile = await runInterview(prompter, existing);
		saveProfile(db, profile);
		saved = true;
	} finally {
		await prompter.close();
		db.close();
	}
	if (saved) {
		console.log("Saved your profile locally.");
	}
}

main().catch((err: unknown) => {
	// Generic message so profile PII can never ride out in an error string; detail behind DEBUG.
	console.error("Something went wrong. Re-run with DEBUG=1 for details.");
	if (process.env.DEBUG) {
		console.error(err);
	}
	process.exitCode = 1;
});
