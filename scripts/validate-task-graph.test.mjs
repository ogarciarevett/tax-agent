#!/usr/bin/env node
// Self-test for validate-task-graph.mjs. No framework: `node scripts/validate-task-graph.test.mjs`.
// Exits non-zero on failure. Kept out of the vitest suite because it tests repo machinery, not src/.

import assert from "node:assert/strict";
import {
	computeCriticalPath,
	globMatch,
	globsOverlap,
	matchesAny,
	parseCliArgs,
	parsePorcelainZ,
	readSpecCriteria,
	readyConflicts,
	readyNodes,
	reconcile,
	setsOverlap,
	validateGraph,
} from "./validate-task-graph.mjs";

let passed = 0;
let failed = 0;
function test(name, fn) {
	try {
		fn();
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (e) {
		failed++;
		console.error(`  ✗ ${name}\n    ${e.message}`);
	}
}

const node = (over = {}) => ({
	id: "T.N1",
	title: "n",
	kind: "doc",
	status: "PROPOSED",
	depends_on: [],
	read_set: [],
	write_set: ["a.md"],
	inputs: [],
	outputs: [],
	invariants: [],
	acceptance_criteria: ["AC1"],
	verification_commands: ["true"],
	risk: "low",
	financially_material: false,
	side_effects: [],
	compensation: [],
	parallel_safe: null,
	evidence: [],
	...over,
});

const graph = (nodes, over = {}) => ({
	schema_version: "1.0",
	task_id: "T",
	spec_source: "EXTERNAL-1",
	goal: "g",
	bootstrap_exception: false,
	graph_delta: {
		nodes_added: [],
		nodes_modified: [],
		nodes_removed: [],
		edges_added: [],
		edges_removed: [],
	},
	nodes,
	critical_path: [],
	global_gates: [],
	open_questions: [],
	...over,
});

const errs = (g) => validateGraph(g, { checkSpecSource: false }).errors;
const warns = (g) => validateGraph(g, { checkSpecSource: false }).warnings;

console.log("glob matching");
test("* does not cross a slash", () => {
	assert.ok(globMatch(".ai/commands/*.md", ".ai/commands/build.md"));
	assert.ok(!globMatch(".ai/commands/*.md", ".ai/commands/sub/build.md"));
});
test("** crosses slashes", () => {
	assert.ok(globMatch("src/**", "src/a/b/c.ts"));
	assert.ok(globMatch(".ai/**/SKILL.md", ".ai/skills/x/SKILL.md"));
});
test("dots are literal, not wildcards", () => {
	assert.ok(!globMatch(".ai/x.md", "Xai/xYmd"));
});
test("matchesAny", () => {
	assert.ok(matchesAny("src/a.ts", ["docs/**", "src/**"]));
	assert.ok(!matchesAny("README.md", ["docs/**", "src/**"]));
});

console.log("overlap detection");
test("identical globs overlap", () => assert.ok(globsOverlap("a.md", "a.md")));
test("distinct literals do not overlap", () =>
	assert.ok(!globsOverlap("a.md", "b.md")));
test("wildcard covering a literal overlaps", () => {
	assert.ok(globsOverlap(".ai/commands/*.md", ".ai/commands/build.md"));
});
test("disjoint trees do not overlap", () => {
	assert.ok(!setsOverlap([".ai/**"], ["src/**"]));
});
test("overlap is conservative for two wildcards on the same prefix", () => {
	assert.ok(setsOverlap([".ai/skills/**"], [".ai/skills/a/*.md"]));
});

console.log("validation — the three gates that matter");
test("AC1: a dependency cycle is detected", () => {
	const g = graph([
		node({ id: "T.N1", depends_on: ["T.N2"], write_set: ["a.md"] }),
		node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
	]);
	assert.ok(
		errs(g).some((e) => e.includes("cycle")),
		`expected a cycle error, got: ${errs(g)}`,
	);
});
test("AC2: VERIFIED without evidence is rejected", () => {
	const g = graph([node({ status: "VERIFIED", evidence: [] })]);
	assert.ok(errs(g).some((e) => e.includes("VERIFIED with no evidence")));
});
test("AC2b: VERIFIED with evidence is accepted", () => {
	const g = graph([
		node({
			status: "VERIFIED",
			evidence: [{ criterion: "AC1", command: "true", output_excerpt: "ok" }],
		}),
	]);
	assert.deepEqual(errs(g), []);
});
test("AC3: independent nodes with overlapping write sets are flagged", () => {
	const g = graph([
		node({ id: "T.N1", write_set: [".ai/commands/*.md"] }),
		node({ id: "T.N2", write_set: [".ai/commands/build.md"] }),
	]);
	assert.ok(
		warns(g).some((w) => w.includes("NOT parallel-safe")),
		`expected a parallel-safety warning, got: ${warns(g)}`,
	);
});
test("AC3b: dependent nodes sharing a file are NOT flagged (ordering makes it safe)", () => {
	const g = graph([
		node({ id: "T.N1", write_set: [".ai/commands/build.md"] }),
		node({
			id: "T.N2",
			depends_on: ["T.N1"],
			write_set: [".ai/commands/build.md"],
		}),
	]);
	assert.deepEqual(warns(g), []);
});

console.log("validation — remaining schema rules");
test("a valid minimal graph passes clean", () =>
	assert.deepEqual(errs(graph([node()])), []));
test("wrong schema_version is rejected", () => {
	assert.ok(
		errs(graph([node()], { schema_version: "2.0" })).some((e) =>
			e.includes("schema_version"),
		),
	);
});
test("unresolved dependency is rejected", () => {
	assert.ok(
		errs(graph([node({ depends_on: ["T.NX"] })])).some((e) =>
			e.includes("unknown node"),
		),
	);
});
test("self-dependency is rejected", () => {
	assert.ok(
		errs(graph([node({ depends_on: ["T.N1"] })])).some((e) =>
			e.includes("itself"),
		),
	);
});
test("duplicate node ids are rejected", () => {
	assert.ok(
		errs(graph([node(), node()])).some((e) => e.includes("duplicate node id")),
	);
});
test("a node with neither criteria nor invariants is unexplained scope", () => {
	assert.ok(
		errs(graph([node({ acceptance_criteria: [], invariants: [] })])).some((e) =>
			e.includes("unexplained scope"),
		),
	);
});
test("a node with only invariants is accepted", () => {
	assert.deepEqual(
		errs(
			graph([
				node({
					acceptance_criteria: [],
					invariants: ["money is integer cents"],
				}),
			]),
		),
		[],
	);
});
test("a node with no verification command is rejected", () => {
	assert.ok(
		errs(graph([node({ verification_commands: [] })])).some((e) =>
			e.includes("verification_command"),
		),
	);
});
test("an empty write_set is rejected", () => {
	assert.ok(
		errs(graph([node({ write_set: [] })])).some((e) =>
			e.includes("write_set is empty"),
		),
	);
});
test("side_effects without compensation is rejected", () => {
	assert.ok(
		errs(graph([node({ side_effects: ["applies a migration"] })])).some((e) =>
			e.includes("no compensation"),
		),
	);
});
test("compensation without side_effects is rejected", () => {
	assert.ok(
		errs(graph([node({ compensation: ["down migration"] })])).some((e) =>
			e.includes("no side_effects"),
		),
	);
});
test("authored parallel_safe is rejected", () => {
	assert.ok(
		errs(graph([node({ parallel_safe: true })])).some((e) =>
			e.includes("derived, not authored"),
		),
	);
});
test("non-boolean bootstrap_exception is rejected", () => {
	assert.ok(
		errs(graph([node()], { bootstrap_exception: undefined })).some((e) =>
			e.includes("bootstrap_exception"),
		),
	);
});
test("critical_path referencing an unknown node is rejected", () => {
	assert.ok(
		errs(graph([node()], { critical_path: ["T.NX"] })).some((e) =>
			e.includes("critical_path references"),
		),
	);
});
test("invalid status is rejected", () => {
	assert.ok(
		errs(graph([node({ status: "DONE" })])).some((e) =>
			e.includes("invalid status"),
		),
	);
});
test("missing spec_source on disk is rejected when checked", () => {
	const g = graph([node()], { spec_source: ".ai/specs/does-not-exist.md" });
	assert.ok(
		validateGraph(g).errors.some((e) => e.includes("does not exist on disk")),
	);
});

console.log("criterion resolution (the AC15 class of precedence violation)");
test("a cited AC that the spec does not define is rejected", () => {
	// P1-spec.md really defines AC1..AC16, so AC99 must be rejected against it.
	const g = graph([node({ acceptance_criteria: ["AC99 invented"] })], {
		spec_source: ".ai/specs/P1-spec.md",
	});
	assert.ok(
		validateGraph(g).errors.some((e) => e.includes("cites AC99")),
		`expected an unresolved-criterion error, got: ${validateGraph(g).errors}`,
	);
});
test("a cited AC that the spec does define is accepted", () => {
	const g = graph([node({ acceptance_criteria: ["AC1 sh -n exits 0"] })], {
		spec_source: ".ai/specs/P1-spec.md",
	});
	assert.ok(!validateGraph(g).errors.some((e) => e.includes("cites AC")));
});
test("an invariant-tagged criterion is not treated as an AC reference", () => {
	const g = graph(
		[node({ acceptance_criteria: ["invariant: money is integer cents"] })],
		{ spec_source: ".ai/specs/P1-spec.md" },
	);
	assert.ok(!validateGraph(g).errors.some((e) => e.includes("cites AC")));
});
test("the check is skipped for an external ticket spec_source", () => {
	const g = graph([node({ acceptance_criteria: ["AC99 invented"] })], {
		spec_source: "ENG-421",
	});
	assert.ok(!validateGraph(g).errors.some((e) => e.includes("cites AC99")));
});
test("readSpecCriteria parses the template's numbered checkbox shape", () => {
	const nums = readSpecCriteria(".ai/specs/P1-spec.md");
	assert.ok(nums.has(1) && nums.has(14) && nums.has(15) && nums.has(16));
	assert.ok(!nums.has(99));
});

console.log("readiness");
test("a node whose dependency is unverified is not READY", () => {
	const g = graph([
		node({ id: "T.N1" }),
		node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
	]);
	assert.deepEqual(
		readyNodes(g).map((n) => n.id),
		["T.N1"],
	);
});
test("a node whose dependency is VERIFIED is READY", () => {
	const g = graph([
		node({ id: "T.N1", status: "VERIFIED", evidence: [{ criterion: "AC1" }] }),
		node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
	]);
	assert.deepEqual(
		readyNodes(g).map((n) => n.id),
		["T.N2"],
	);
});
test("a write-set conflict with an IMPLEMENTING node blocks readiness", () => {
	const g = graph([
		node({ id: "T.N1", status: "IMPLEMENTING", write_set: ["shared.md"] }),
		node({ id: "T.N2", write_set: ["shared.md"] }),
	]);
	assert.deepEqual(
		readyNodes(g).map((n) => n.id),
		[],
	);
});

console.log("critical path");
test("longest chain wins", () => {
	const g = graph([
		node({ id: "T.N1", write_set: ["a.md"] }),
		node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
		node({ id: "T.N3", depends_on: ["T.N2"], write_set: ["c.md"] }),
		node({ id: "T.N4", write_set: ["d.md"] }),
	]);
	assert.deepEqual(computeCriticalPath(g), ["T.N1", "T.N2", "T.N3"]);
});

console.log("cli arg parsing");
test("a bare file argument is not swallowed when --base is absent", () => {
	// Regression: `baseIdx + 1` is 0 when --base is missing, which excluded the first file.
	const { mode, base, files } = parseCliArgs(["graph.json"]);
	assert.equal(mode, "validate");
	assert.equal(base, null);
	assert.deepEqual(files, ["graph.json"]);
});
test("--ready keeps its file", () => {
	assert.deepEqual(parseCliArgs(["--ready", "graph.json"]).files, [
		"graph.json",
	]);
	assert.equal(parseCliArgs(["--ready", "graph.json"]).mode, "ready");
});
test("--base consumes exactly its own value", () => {
	const { mode, base, files } = parseCliArgs([
		"--reconcile",
		"--base",
		"main",
		"graph.json",
	]);
	assert.equal(mode, "reconcile");
	assert.equal(base, "main");
	assert.deepEqual(files, ["graph.json"]);
});
test("multiple files are all kept", () => {
	assert.deepEqual(parseCliArgs(["a.json", "b.json"]).files, [
		"a.json",
		"b.json",
	]);
});

console.log("reconcile");
test("a file outside every write_set is unexplained scope", () => {
	const g = graph([node({ write_set: [".ai/context.md"] })]);
	const r = reconcile(g, [".ai/context.md", "src/sneaky.ts"]);
	assert.deepEqual(r.unexplained, ["src/sneaky.ts"]);
});
test("declared writes never touched are reported", () => {
	const g = graph([node({ write_set: [".ai/context.md", ".ai/pipeline.md"] })]);
	const r = reconcile(g, [".ai/context.md"]);
	assert.deepEqual(r.untouched, [".ai/pipeline.md"]);
	assert.deepEqual(r.unexplained, []);
});

console.log("consensus-review fixes — state machine");
test("a node persisted as READY is still selectable (was a silent dead end)", () => {
	const g = graph([node({ status: "READY" })]);
	assert.deepEqual(
		readyNodes(g).map((n) => n.id),
		["T.N1"],
	);
});
test("VERIFIED with a non-VERIFIED dependency is rejected (state skipping)", () => {
	const g = graph([
		node({ id: "T.N1", status: "PROPOSED" }),
		node({
			id: "T.N2",
			status: "VERIFIED",
			depends_on: ["T.N1"],
			write_set: ["b.md"],
			evidence: [{ criterion: "AC1", command: "true", output_excerpt: "ok" }],
		}),
	]);
	assert.ok(errs(g).some((e) => e.includes("states cannot be skipped")));
});
test("VERIFIED after a SUPERSEDED dependency is allowed", () => {
	const g = graph([
		node({ id: "T.N1", status: "SUPERSEDED" }),
		node({
			id: "T.N2",
			status: "VERIFIED",
			depends_on: ["T.N1"],
			write_set: ["b.md"],
			evidence: [{ criterion: "AC1", command: "true", output_excerpt: "ok" }],
		}),
	]);
	assert.ok(!errs(g).some((e) => e.includes("states cannot be skipped")));
});
test("an input that does not exist blocks readiness even without a slash", () => {
	const g = graph([node({ inputs: ["approved-spec.md"] })]);
	assert.deepEqual(readyNodes(g), []);
});
test("readyConflicts names pairs that must not be built concurrently", () => {
	const g = graph([
		node({ id: "T.N1", write_set: ["shared.md"] }),
		node({ id: "T.N2", write_set: ["shared.md"] }),
	]);
	assert.deepEqual(readyConflicts(readyNodes(g)), [["T.N1", "T.N2"]]);
});

console.log("consensus-review fixes — malformed input must not crash");
test("a string write_set reports a type error instead of throwing", () => {
	const g = graph([node({ write_set: "a.md" })]);
	assert.ok(errs(g).some((e) => e.includes("write_set must be an array")));
});
test("a string depends_on reports a type error instead of throwing", () => {
	const g = graph([node({ depends_on: "T.N2" })]);
	assert.ok(errs(g).some((e) => e.includes("depends_on must be an array")));
});
test("a string inputs reports a type error instead of throwing", () => {
	const g = graph([node({ inputs: "src/x.ts" })]);
	assert.ok(errs(g).some((e) => e.includes("inputs must be an array")));
});
test("an unknown kind is rejected", () => {
	assert.ok(
		errs(graph([node({ kind: "wombat" })])).some((e) =>
			e.includes("invalid kind"),
		),
	);
});

console.log("consensus-review fixes — critical_path is not decoration");
test("a critical_path that is not a real edge chain is rejected", () => {
	const g = graph(
		[
			node({ id: "T.N1", write_set: ["a.md"] }),
			node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
			node({ id: "T.N3", depends_on: ["T.N2"], write_set: ["c.md"] }),
		],
		{ critical_path: ["T.N3", "T.N1"] },
	);
	assert.ok(errs(g).some((e) => e.includes("not a real edge chain")));
});
test("a genuine chain is accepted", () => {
	const g = graph(
		[
			node({ id: "T.N1", write_set: ["a.md"] }),
			node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
		],
		{ critical_path: ["T.N1", "T.N2"] },
	);
	assert.deepEqual(errs(g), []);
});
test("computeCriticalPath does not stack-overflow on a cyclic graph", () => {
	const g = graph([
		node({ id: "T.N1", depends_on: ["T.N2"], write_set: ["a.md"] }),
		node({ id: "T.N2", depends_on: ["T.N1"], write_set: ["b.md"] }),
	]);
	assert.ok(Array.isArray(computeCriticalPath(g)));
});

console.log("consensus-review fixes — argv safety");
test("--base may not take a flag-shaped value (git argv injection)", () => {
	const r = parseCliArgs([
		"--reconcile",
		"--base",
		"--output=/tmp/PWNED",
		"g.json",
	]);
	assert.ok(r.error?.includes("may not start"), `got ${JSON.stringify(r)}`);
});
test("--base with no value is an error, not a silent downgrade", () => {
	assert.ok(parseCliArgs(["--reconcile", "g.json", "--base"]).error);
});
test("--ready and --reconcile together is an error, not a silent win", () => {
	assert.ok(parseCliArgs(["--ready", "--reconcile", "g.json"]).error);
});
test("--node is parsed and does not swallow the graph file", () => {
	const r = parseCliArgs(["--reconcile", "--node", "P1.N9", "g.json"]);
	assert.equal(r.node, "P1.N9");
	assert.deepEqual(r.files, ["g.json"]);
});

console.log("consensus-review fixes — porcelain parsing");
test("-z output keeps spaces and non-ASCII intact", () => {
	const out = parsePorcelainZ(
		"?? plain.md\0?? with space.md\0?? docs/año.md\0",
	);
	assert.deepEqual(out, ["plain.md", "with space.md", "docs/año.md"]);
});
test("a rename yields BOTH destination and source", () => {
	// -z puts the destination in the entry and the source in the following field.
	assert.deepEqual(parsePorcelainZ("R  new.md\0old.md\0"), [
		"new.md",
		"old.md",
	]);
});

console.log("consensus-review fixes — reconcile scoping");
test("--node scopes unexplained scope to that node's write_set", () => {
	const g = graph([
		node({ id: "T.N1", write_set: ["a.md"] }),
		node({ id: "T.N2", write_set: ["b.md"] }),
	]);
	assert.deepEqual(reconcile(g, ["a.md", "b.md"]).unexplained, []);
	assert.deepEqual(reconcile(g, ["a.md", "b.md"], "T.N1").unexplained, [
		"b.md",
	]);
});

console.log(
	"ReDoS — the shape that actually blew up (31s PoC), not the one the old fix handled",
);
test("non-consecutive ** separated by a literal stays fast", () => {
	// The earlier mitigation collapsed CONSECUTIVE `**/` runs, and the earlier test used exactly
	// that shape — so it passed while `a**/a**/…` still took 31 seconds. This is the real shape.
	const glob = `${"a**/".repeat(4)}z`;
	const path = `${"a/".repeat(800)}q`;
	const t0 = Date.now();
	assert.equal(globMatch(glob, path), false);
	const ms = Date.now() - t0;
	assert.ok(ms < 250, `took ${ms}ms — backtracking still reachable`);
});
test("many single-star segments stay fast (the classic ReDoS shape)", () => {
	// Matches (every `a` in the pattern finds an `a`); the point is that it returns FAST.
	// A compiled RegExp `^[^/]*a[^/]*a…$` is where this shape historically explodes.
	const t0 = Date.now();
	assert.equal(globMatch(`${"*a".repeat(20)}*`, "a".repeat(2000)), true);
	assert.ok(Date.now() - t0 < 250, `took ${Date.now() - t0}ms`);
	// The non-matching variant is the expensive one for a backtracking engine.
	const t1 = Date.now();
	assert.equal(globMatch(`${"*a".repeat(20)}*z`, "a".repeat(2000)), false);
	assert.ok(Date.now() - t1 < 250, `took ${Date.now() - t1}ms`);
});
test("deep **/ runs stay fast", () => {
	const t0 = Date.now();
	globMatch(`${"**/".repeat(12)}x`, `${"a/".repeat(24)}y`);
	assert.ok(Date.now() - t0 < 250);
});
test("glob semantics survive the rewrite", () => {
	assert.ok(globMatch("a/**/b", "a/b")); // ** matches zero segments
	assert.ok(globMatch("a/**/b", "a/x/y/b"));
	assert.ok(globMatch("docs/adr/*.md", "docs/adr/0001-x.md"));
	assert.ok(!globMatch("docs/adr/*.md", "docs/adr/sub/0001-x.md"));
	assert.ok(globMatch("?.md", "a.md"));
	assert.ok(!globMatch("?.md", "ab.md"));
});
test("an over-long glob is rejected", () => {
	const g = graph([node({ write_set: [`x/${"a/".repeat(200)}b`] })]);
	assert.ok(errs(g).some((e) => e.includes("longer than")));
});
test("a node id containing terminal escapes is sanitized in output", () => {
	const g = graph([node({ id: "T.\u001b[31mN1", status: "DONE" })]);
	assert.ok(
		!errs(g).some((e) => e.includes("\u001b")),
		"escape reached the message",
	);
});
test("a graph over the node cap is rejected rather than OOMing", () => {
	const many = Array.from({ length: 2001 }, (_, i) =>
		node({ id: `T.N${i}`, write_set: [`f${i}.md`] }),
	);
	assert.ok(errs(graph(many)).some((e) => e.includes("node cap")));
});

console.log("security audit fixes (codex seat)");
test("H1: a VERIFIED node with null evidence/commands is rejected", () => {
	const g = graph([
		node({
			status: "VERIFIED",
			verification_commands: [null],
			write_set: [null],
			evidence: [null],
		}),
	]);
	const e = errs(g);
	assert.ok(
		e.some((x) => x.includes("verification_commands contains a non-string")),
		e,
	);
	assert.ok(
		e.some((x) => x.includes("write_set contains a non-string")),
		e,
	);
	assert.ok(
		e.some((x) => x.includes("evidence entry must be an object")),
		e,
	);
});
test("H1b: evidence with a command but no output_excerpt is rejected", () => {
	const g = graph([
		node({
			status: "VERIFIED",
			evidence: [{ criterion: "AC1", command: "pnpm test" }],
		}),
	]);
	assert.ok(errs(g).some((x) => x.includes("no output_excerpt")));
});
test("H1c: evidence with neither command nor file_ref is rejected", () => {
	const g = graph([
		node({ status: "VERIFIED", evidence: [{ criterion: "AC1" }] }),
	]);
	assert.ok(errs(g).some((x) => x.includes("nothing to re-run")));
});
test("H1d: a file_ref-only evidence entry is accepted", () => {
	const g = graph([
		node({
			status: "VERIFIED",
			evidence: [{ criterion: "AC1", file_ref: "src/x.ts:42" }],
		}),
	]);
	assert.deepEqual(errs(g), []);
});
test("M3: an absolute spec_source is rejected", () => {
	const g = graph([node()], { spec_source: "/etc/passwd.md" });
	assert.ok(validateGraph(g).errors.some((e) => e.includes("repo-relative")));
});
test("M3b: a traversing spec_source is rejected", () => {
	const g = graph([node()], { spec_source: "../../elsewhere/spec.md" });
	assert.ok(validateGraph(g).errors.some((e) => e.includes("repo-relative")));
});
test("M1: an over-complex glob is rejected rather than compiled", () => {
	const g = graph([node({ write_set: [`${"*a".repeat(12)}*`] })]);
	assert.ok(errs(g).some((e) => e.includes("wildcards")));
});
test("M4: an unknown flag is an error, not silently ignored", () => {
	assert.ok(
		parseCliArgs(["--reconcille", "g.json"]).error?.includes("unknown option"),
	);
});
test("M4b: --base outside reconcile mode is an error", () => {
	assert.ok(parseCliArgs(["--ready", "--base", "main", "g.json"]).error);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
