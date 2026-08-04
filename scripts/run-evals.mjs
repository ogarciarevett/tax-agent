#!/usr/bin/env node

// run-evals.mjs — execute the EVALS.md catalogue and print the four-surface matrix.
//
// Zero dependencies. It does NOT reimplement test logic: each surface binds to an existing
// vitest file or spawns the real CLI. Duplicating assertions here would create a second source
// of truth that drifts from the suite.
//
// Honesty rules enforced by construction:
//   - a surface is never silently omitted — all four are printed for every eval
//   - `blocked` and `not-implemented` never count as passing and never affect the exit code
//   - the pass rate counts ONLY surfaces actually asserted
//
// Usage: node scripts/run-evals.mjs [--json]
// Exit:  0 all asserted surfaces passed · 1 an asserted surface failed · 2 usage

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const SURFACES = ["UI", "LOG", "DB", "OUT"];

/** A surface bound to a vitest file (optionally a single test name). */
const test = (file, why) => ({ kind: "test", file, why });
/** A surface bound to spawning the real CLI. */
const cli = (args, expectExit, why) => ({ kind: "cli", args, expectExit, why });
const na = (why) => ({ kind: "na", why });
const blocked = (why) => ({ kind: "blocked", why });
const todo = () => ({ kind: "not-implemented", why: "platform not built" });

const EVALS = [
	{
		id: "L1",
		feature: "Profile interview",
		UI: blocked(
			"opentui needs a real TTY/pty; render proven by manual `pnpm dev`",
		),
		LOG: test("src/domain/profile.test.ts", "no PII emitted by the pure path"),
		DB: test(
			"src/storage/profile-repo.test.ts",
			"one row, round-trips, invalid writes zero",
		),
		OUT: test(
			"src/interview/interview.test.ts",
			"answers -> Profile; invalid -> Zod error",
		),
	},
	{
		id: "L2",
		feature: "Bill scan (idempotent)",
		UI: na("scan is headless (cron-invoked); it has no interactive surface"),
		LOG: test(
			"src/ingest/scan.test.ts",
			"counts/ids/reason codes, no vendor/subject/amount",
		),
		DB: test(
			"src/storage/ingest-repo.test.ts",
			"second identical run inserts 0 rows",
		),
		OUT: test("src/ingest/files.test.ts", "one .md per bill"),
	},
	{
		id: "L3",
		feature: "Never-fabricate gate",
		UI: na("headless"),
		LOG: test("src/ingest/scan-task.test.ts", "reason code on rejection"),
		DB: test("src/ingest/verify.test.ts", "rejected bill stores no bills row"),
		OUT: test(
			"src/ingest/verify.test.ts",
			"no .md written for a rejected bill",
		),
	},
	{
		id: "L4",
		feature: "Month report",
		UI: blocked(
			"TUI table view needs a TTY; the rendered string is identical on both paths",
		),
		LOG: na("report is a pure read; it logs nothing by design"),
		DB: test("src/storage/ingest-repo.test.ts", "renders the rows it reads"),
		OUT: test(
			"src/report/render-month-table.test.ts",
			"golden string, integer cents",
		),
	},
	{
		id: "L5",
		feature: "Spain rules traceability",
		UI: na("pure module"),
		LOG: na("pure module"),
		DB: na("operates on already-loaded records"),
		OUT: test(
			"src/countries/es/report.test.ts",
			"TraceableFigure throws without sources",
		),
	},
	{
		id: "L6",
		feature: "Cron wrapper",
		UI: na("headless"),
		LOG: blocked("needs the user's real crontab + a live agent CLI"),
		DB: blocked("same"),
		OUT: blocked("same"),
	},
	{
		id: "L7",
		feature: "CLI router",
		UI: na("argv parsing"),
		LOG: cli(["definitely-not-a-command"], 2, "usage on stderr, not stdout"),
		DB: na("no persistence"),
		OUT: test(
			"src/cli/args.test.ts",
			"exit 2 on bad args; correct kind on good args",
		),
	},
	...[
		["P1", "Ledger fact ingest"],
		["P2", "Budget / monthly cash flow"],
		["P3", "Tax reserve loop (closed)"],
		["P4", "Debt plan"],
		["P5", "Goal dependencies"],
		["P6", "Mortgage readiness"],
		["P7", "Multi-currency"],
		["P8", "Fiat + crypto assets"],
		["P9", "Document ingestion"],
		["P10", "Hybrid retrieval (RRF)"],
		["P11", "Domain graph explanation"],
		["P12", "Auditable recommendation"],
		["P13", "Tenant isolation"],
		["P14", "No-LLM-arithmetic guard"],
	].map(([id, feature]) => ({
		id,
		feature,
		UI: todo(),
		LOG: todo(),
		DB: todo(),
		OUT: todo(),
	})),
];

const vitestCache = new Map();

function runVitest(file) {
	if (vitestCache.has(file)) return vitestCache.get(file);
	if (!existsSync(file)) {
		const miss = { ok: false, note: `test file missing: ${file}` };
		vitestCache.set(file, miss);
		return miss;
	}
	const r = spawnSync("pnpm", ["exec", "vitest", "run", file], {
		encoding: "utf8",
	});
	const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
	const m = /Tests\s+(\d+) passed/.exec(out);
	const res = {
		ok: r.status === 0,
		note:
			r.status === 0
				? `${m?.[1] ?? "?"} tests passed`
				: `vitest exit ${r.status}`,
	};
	vitestCache.set(file, res);
	return res;
}

function runCli(args, expectExit) {
	const r = spawnSync("pnpm", ["exec", "tsx", "src/index.ts", ...args], {
		encoding: "utf8",
	});
	const stderr = r.stderr ?? "";
	const stdout = r.stdout ?? "";
	// The eval is "usage goes to stderr, not stdout" — assert both the code and the stream.
	const usageOnStderr = /usage/i.test(stderr) && !/usage/i.test(stdout);
	return {
		ok: r.status === expectExit && usageOnStderr,
		note: `exit ${r.status} (want ${expectExit}); usage on stderr: ${usageOnStderr}`,
	};
}

function evaluate(surface) {
	switch (surface.kind) {
		case "test": {
			const r = runVitest(surface.file);
			return {
				mark: r.ok ? "assert ✅" : "assert ❌",
				ok: r.ok,
				asserted: true,
				note: r.note,
			};
		}
		case "cli": {
			const r = runCli(surface.args, surface.expectExit);
			return {
				mark: r.ok ? "assert ✅" : "assert ❌",
				ok: r.ok,
				asserted: true,
				note: r.note,
			};
		}
		case "na":
			return { mark: "n/a", ok: true, asserted: false, note: surface.why };
		case "blocked":
			return {
				mark: "blocked 🚫",
				ok: true,
				asserted: false,
				note: surface.why,
			};
		default:
			return {
				mark: "not-impl ⬜",
				ok: true,
				asserted: false,
				note: surface.why,
			};
	}
}

function main(argv) {
	const json = argv.includes("--json");
	if (argv.some((a) => a.startsWith("-") && a !== "--json")) {
		console.error("usage: run-evals.mjs [--json]");
		return 2;
	}

	const rows = [];
	let asserted = 0;
	let failed = 0;

	for (const e of EVALS) {
		const row = { id: e.id, feature: e.feature, surfaces: {} };
		for (const s of SURFACES) {
			// A missing surface definition is itself a failure — surfaces are never omitted.
			if (!e[s]) {
				row.surfaces[s] = {
					mark: "MISSING ❌",
					ok: false,
					asserted: true,
					note: "surface not accounted for",
				};
				failed++;
				asserted++;
				continue;
			}
			const r = evaluate(e[s]);
			row.surfaces[s] = r;
			if (r.asserted) {
				asserted++;
				if (!r.ok) failed++;
			}
		}
		const marks = SURFACES.map((s) => row.surfaces[s]);
		row.status = marks.some((m) => m.asserted && !m.ok)
			? "❌"
			: marks.every((m) => m.mark.startsWith("not-impl"))
				? "⬜"
				: marks.every((m) => !m.asserted)
					? "🚫"
					: marks.some((m) => m.mark.startsWith("blocked"))
						? "⚠️"
						: "✅";
		rows.push(row);
	}

	if (json) {
		console.log(JSON.stringify({ rows, asserted, failed }, null, 2));
		return failed > 0 ? 1 : 0;
	}

	console.log("EVAL RESULTS — every eval accounts for all four surfaces\n");
	console.log(
		"| ID  | Feature                      | UI          | LOG         | DB          | OUT         | Status |",
	);
	console.log(
		"|-----|------------------------------|-------------|-------------|-------------|-------------|--------|",
	);
	for (const r of rows) {
		const c = (s) => r.surfaces[s].mark.padEnd(11).slice(0, 11);
		console.log(
			`| ${r.id.padEnd(3)} | ${r.feature.padEnd(28).slice(0, 28)} | ${c("UI")} | ${c("LOG")} | ${c("DB")} | ${c("OUT")} | ${r.status.padEnd(6)} |`,
		);
	}
	console.log("\nNotes:");
	for (const r of rows) {
		if (r.status === "⬜") continue;
		for (const s of SURFACES) {
			const x = r.surfaces[s];
			if (x.mark !== "n/a")
				console.log(`  ${r.id} ${s.padEnd(3)} ${x.mark.padEnd(11)} ${x.note}`);
		}
	}
	const notImpl = rows.filter((r) => r.status === "⬜").length;
	console.log(
		`\n${asserted - failed}/${asserted} asserted surfaces passed · ${failed} failed · ` +
			`${notImpl} features not implemented (never counted as passing)`,
	);
	return failed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	process.exit(main(process.argv.slice(2)));
}

export { EVALS, SURFACES };
