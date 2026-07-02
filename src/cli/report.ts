import { getCountryModule } from "../countries/registry";
import { renderMonthTable } from "../report/render-month-table";
import { openDb } from "../storage/db";
import { createIngestRepo } from "../storage/ingest-repo";
import { loadProfile } from "../storage/profile-repo";
import { showTable } from "../tui/table-view";

/**
 * `tax-agent report [--month YYYY-MM]`: load the profile + this month's bills, build the
 * country-specific report, and render the pure table. On a TTY it opens the opentui view; otherwise
 * (cron / pipes) it prints the IDENTICAL string to stdout. No PII ever leaves the device.
 */
export async function runReportCommand(month: string): Promise<void> {
	const db = openDb();
	try {
		const profile = loadProfile(db);
		if (!profile) {
			console.log("No profile yet. Run `tax-agent interview` first.");
			return;
		}
		const repo = createIngestRepo(db);
		const bills = repo.listBillsForMonth(month);
		const pending = repo.countAttachmentPendingForMonth(month);
		// The es module slices month figures itself; the wider quarter set makes the
		// Modelo 303/130 lines cover the WHOLE quarter, not just the displayed month.
		const report = getCountryModule(profile.country).buildMonthReport({
			bills: repo.listBillsForQuarterContaining(month),
			profile,
			month,
		});
		const text = renderMonthTable({
			month,
			bills,
			report,
			pendingCount: pending,
		});

		if (process.stdout.isTTY) {
			await showTable(text);
		} else {
			console.log(text);
		}
	} finally {
		db.close();
	}
}
