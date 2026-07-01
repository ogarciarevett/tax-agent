import { defineConfig } from "vitest/config";

// The CLI entry and opentui render layer are excluded — they need a TTY and are proven by a
// manual `pnpm dev` run (A1-spec "Risks & assumptions"), not unit tests. Everything else (domain,
// interview logic, storage) must clear the 80% gate.
export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/index.ts", "src/tui/**"],
			thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
		},
	},
});
