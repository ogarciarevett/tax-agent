import { defineConfig } from "vitest/config";

// The CLI entry, per-command shells, and opentui render layer are excluded — they need a TTY or
// real processes and are proven by manual runs (see the task specs), not unit tests. Everything
// else (domain, interview logic, storage, cli/args) must clear the 80% gate.
export default defineConfig({
	test: {
		// Vitest owns src/. `scripts/validate-task-graph.test.mjs` is repo machinery with its own
		// zero-dependency runner (`pnpm test:graph`); without this, vitest's default discovery picks
		// it up and fails on its top-level `process.exit`.
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				"src/index.ts",
				"src/tui/**",
				"src/cli/interview.ts",
				"src/cli/scan.ts",
				"src/cli/report.ts",
			],
			thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
		},
	},
});
