#!/usr/bin/env node

// validate-task-graph.mjs — validator for .ai/specs/task-graphs/<task-id>.json
//
// Zero dependencies, plain Node. This is NOT a workflow engine: it stores no state, schedules
// nothing, and executes no nodes. It exists so that "the graph is acyclic / every node is
// explained / nothing is VERIFIED without evidence" is PROVEN by a non-zero exit code instead of
// asserted in prose. See .ai/references/task-graph-schema.md.
//
// Usage:
//   node scripts/validate-task-graph.mjs <graph.json> [<graph.json> ...]
//   node scripts/validate-task-graph.mjs --ready <graph.json>
//   node scripts/validate-task-graph.mjs --reconcile [--base <ref>] [--node <id>] <graph.json>

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const NODE_STATES = new Set([
	"PROPOSED",
	"READY",
	"IMPLEMENTING",
	"TESTED",
	"REVIEWED",
	"RECONCILED",
	"VERIFIED",
	"BLOCKED",
	"TEST_FAILED",
	"REVIEW_FAILED",
	"GRAPH_DRIFT",
	"INVARIANT_FAILED",
	"SUPERSEDED",
]);
// Selectable states: a node the lead may still pick up. READY is included because the transition
// table lets the lead persist it; excluding it made a persisted READY node permanently invisible.
const SELECTABLE = new Set(["PROPOSED", "READY"]);
const TERMINAL = new Set(["VERIFIED", "SUPERSEDED"]);
const RISKS = new Set(["low", "medium", "high", "critical"]);
const RISK_WEIGHT = { low: 1, medium: 2, high: 3, critical: 4 };
const KINDS = new Set([
	"contract",
	"command",
	"skill",
	"persona",
	"reference",
	"spec",
	"adr",
	"doc",
	"script",
	"test",
	"schema",
	"migration",
	"ui",
	"api",
]);

// ---------------------------------------------------------------- glob helpers

const reCache = new Map();

/** Convert a write_set/read_set glob to a RegExp. `**` crosses `/`, `*` and `?` do not. */
export function globToRegExp(glob) {
	const hit = reCache.get(glob);
	if (hit) return hit;
	// Collapse runs of `**/` before compiling: `**/**/**/x` is equivalent to `**/x` but compiles to
	// nested `(?:.*/)?` groups whose backtracking is catastrophic on a long non-matching path.
	const g = glob.replace(/(?:\*\*\/)+/g, "**/");
	let re = "";
	for (let i = 0; i < g.length; i++) {
		const c = g[i];
		if (c === "*") {
			if (g[i + 1] === "*") {
				i++;
				if (g[i + 1] === "/") {
					i++;
					re += "(?:.*/)?"; // `a/**/b` also matches `a/b`
				} else {
					re += ".*";
				}
			} else {
				re += "[^/]*";
			}
		} else if (c === "?") {
			re += "[^/]";
		} else {
			re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
		}
	}
	const compiled = new RegExp(`^${re}$`);
	reCache.set(glob, compiled);
	return compiled;
}

export function matchesAny(path, globs) {
	return globs.some((g) => globToRegExp(g).test(path));
}

/** Literal portion of a glob before its first wildcard. */
function literalPrefix(glob) {
	const i = glob.search(/[*?]/);
	return i === -1 ? glob : glob.slice(0, i);
}

/**
 * Conservative glob-overlap test. Errs toward reporting overlap, which is the safe direction:
 * a false "these overlap" only denies parallelism; a false "these are disjoint" would authorize
 * two writers onto the same file.
 */
export function globsOverlap(a, b) {
	if (a === b) return true;
	const aWild = /[*?]/.test(a);
	const bWild = /[*?]/.test(b);
	if (!aWild && !bWild) return false;
	if (!aWild) return globToRegExp(b).test(a);
	if (!bWild) return globToRegExp(a).test(b);
	const pa = literalPrefix(a);
	const pb = literalPrefix(b);
	return pa.startsWith(pb) || pb.startsWith(pa);
}

export function setsOverlap(globsA, globsB) {
	return globsA.some((a) => globsB.some((b) => globsOverlap(a, b)));
}

// ---------------------------------------------------------------- spec criteria

/**
 * Numbered acceptance criteria declared by a spec markdown file, as a Set of numbers.
 * Matches the `_task-spec.template.md` shape: `- [ ] 7. …` (checked or unchecked).
 * Returns null when the spec is unavailable (external ticket, or checking disabled) — callers
 * must then skip the cross-file check rather than report false violations.
 */
export function readSpecCriteria(specPath) {
	if (!specPath || !existsSync(specPath)) return null;
	const nums = new Set();
	for (const line of readFileSync(specPath, "utf8").split("\n")) {
		const m = /^\s*-\s*\[[ xX]\]\s*(?:\*\*)?(\d+)\./.exec(line);
		if (m) nums.add(Number(m[1]));
	}
	return nums.size > 0 ? nums : null;
}

// ---------------------------------------------------------------- validation

const isArray = (v) => Array.isArray(v);
const isNonEmptyArray = (v) => Array.isArray(v) && v.length > 0;

const ARRAY_FIELDS = [
	"depends_on",
	"read_set",
	"write_set",
	"inputs",
	"outputs",
	"invariants",
	"acceptance_criteria",
	"verification_commands",
	"side_effects",
	"compensation",
	"evidence",
];
// Fields whose elements must each be a non-empty string.
const STRING_ARRAY_FIELDS = [
	"depends_on",
	"read_set",
	"write_set",
	"inputs",
	"outputs",
	"invariants",
	"acceptance_criteria",
	"verification_commands",
	"side_effects",
	"compensation",
];
const MAX_GLOB_WILDCARDS = 8;

function validateHeader(graph, { spec, checkSpecSource }, err) {
	if (graph.schema_version !== "1.0") {
		err(
			`schema_version must be "1.0" (got ${JSON.stringify(graph.schema_version)})`,
		);
	}
	if (!graph.task_id) err("task_id is required");
	if (!graph.goal) err("goal is required");

	// spec_source: a repo path must exist; anything else is treated as an external ticket ref.
	if (!spec) {
		err("spec_source is required");
	} else if (checkSpecSource && spec.endsWith(".md")) {
		// A local spec must be a repo-relative path. Absolute paths and `..` let a graph name an
		// uncommitted, developer-specific, or out-of-tree file as its normative spec.
		if (spec.startsWith("/") || spec.split("/").includes("..")) {
			err(`spec_source must be a repo-relative path without "..": ${spec}`);
		} else if (!existsSync(spec)) {
			err(`spec_source does not exist on disk: ${spec}`);
		}
	}

	if (typeof graph.bootstrap_exception !== "boolean") {
		err(
			"bootstrap_exception must be a boolean (state it honestly — see the schema reference)",
		);
	}
	if (graph.graph_delta == null || typeof graph.graph_delta !== "object") {
		err("graph_delta must be an object");
	}
	for (const key of ["global_gates", "open_questions"]) {
		if (!isArray(graph[key])) err(`${key} must be an array`);
	}
}

function validateNode(n, { byId, specCriteria, spec }, err) {
	const at = `node ${n.id}`;

	if (!n.title) err(`${at}: title is required`);
	if (!NODE_STATES.has(n.status))
		err(`${at}: invalid status ${JSON.stringify(n.status)}`);
	if (!RISKS.has(n.risk)) err(`${at}: invalid risk ${JSON.stringify(n.risk)}`);
	if (n.kind !== undefined && !KINDS.has(n.kind))
		err(`${at}: invalid kind ${JSON.stringify(n.kind)}`);
	if (typeof n.financially_material !== "boolean") {
		err(`${at}: financially_material must be a boolean`);
	}

	for (const key of ARRAY_FIELDS) {
		if (!isArray(n[key])) err(`${at}: ${key} must be an array`);
	}
	// Everything below indexes those arrays; bail on this node if any is the wrong shape.
	if (!ARRAY_FIELDS.every((k) => isArray(n[k]))) return;

	// Element-level validation. Checking only "non-empty array" let `verification_commands: [null]`
	// and `evidence: [null]` mark a node VERIFIED with nothing runnable and nothing proven.
	for (const key of STRING_ARRAY_FIELDS) {
		for (const v of n[key]) {
			if (typeof v !== "string" || v.trim() === "") {
				err(
					`${at}: ${key} contains a non-string or empty entry (${JSON.stringify(v)})`,
				);
			}
		}
	}
	for (const e of n.evidence) {
		if (e == null || typeof e !== "object" || Array.isArray(e)) {
			err(`${at}: evidence entry must be an object (${JSON.stringify(e)})`);
			continue;
		}
		if (typeof e.criterion !== "string" || e.criterion.trim() === "") {
			err(`${at}: evidence entry has no criterion`);
		}
		const hasCommand = typeof e.command === "string" && e.command.trim() !== "";
		const hasFileRef =
			typeof e.file_ref === "string" && e.file_ref.trim() !== "";
		if (!hasCommand && !hasFileRef) {
			err(
				`${at}: evidence for ${e.criterion ?? "?"} has neither a command nor a file_ref — nothing to re-run`,
			);
		}
		if (
			hasCommand &&
			(typeof e.output_excerpt !== "string" || e.output_excerpt.trim() === "")
		) {
			err(
				`${at}: evidence for ${e.criterion ?? "?"} records a command but no output_excerpt — a command nobody ran is not evidence`,
			);
		}
	}

	for (const d of n.depends_on) {
		if (!byId.has(d)) err(`${at}: depends_on references unknown node ${d}`);
		if (d === n.id) err(`${at}: depends on itself`);
	}

	// Every node must be explained by at least one criterion or invariant.
	if (
		!isNonEmptyArray(n.acceptance_criteria) &&
		!isNonEmptyArray(n.invariants)
	) {
		err(
			`${at}: has neither acceptance_criteria nor invariants — unexplained scope`,
		);
	}

	// Every node must be checkable.
	if (!isNonEmptyArray(n.verification_commands)) {
		err(`${at}: needs at least one verification_command`);
	}

	// Bound glob complexity: repeated `*a` segments still produce overlapping quantifiers whose
	// backtracking grows steeply (measured ~1.8s at 10 segments). Reject rather than compile.
	for (const key of ["read_set", "write_set"]) {
		for (const g of n[key]) {
			if (
				typeof g === "string" &&
				(g.match(/[*?]/g) ?? []).length > MAX_GLOB_WILDCARDS
			) {
				err(
					`${at}: ${key} glob has more than ${MAX_GLOB_WILDCARDS} wildcards: ${g}`,
				);
			}
		}
	}

	// A node that writes nothing produces nothing.
	if (!isNonEmptyArray(n.write_set)) {
		err(
			`${at}: write_set is empty — a node that writes nothing cannot be verified`,
		);
	}

	// Cited criteria must exist in the normative spec (precedence: the graph never invents one).
	if (specCriteria) {
		for (const c of n.acceptance_criteria) {
			const m = /^AC(\d+)\b/.exec(String(c).trim());
			if (m && !specCriteria.has(Number(m[1]))) {
				err(
					`${at}: cites AC${m[1]}, which ${spec} does not define — the graph may not invent a criterion`,
				);
			}
		}
	}

	// Compensation is required exactly when there are side effects.
	const hasSideEffects = isNonEmptyArray(n.side_effects);
	const hasCompensation = isNonEmptyArray(n.compensation);
	if (hasSideEffects && !hasCompensation) {
		err(`${at}: declares side_effects but no compensation`);
	}
	if (!hasSideEffects && hasCompensation) {
		err(`${at}: declares compensation but no side_effects`);
	}

	// The anti-overclaim check: VERIFIED demands evidence.
	if (n.status === "VERIFIED" && !isNonEmptyArray(n.evidence)) {
		err(`${at}: status VERIFIED with no evidence`);
	}

	// State skipping: a node cannot be VERIFIED while something it depends on is not.
	// Without this, "no state may be skipped" is prose with no mechanism behind it.
	if (n.status === "VERIFIED") {
		for (const d of n.depends_on) {
			const dep = byId.get(d);
			if (dep && !TERMINAL.has(dep.status)) {
				err(
					`${at}: VERIFIED but dependency ${d} is ${dep.status} — states cannot be skipped`,
				);
			}
		}
	}

	// parallel_safe is derived, never authored.
	if (n.parallel_safe !== null && n.parallel_safe !== undefined) {
		err(
			`${at}: parallel_safe must be null in source — it is derived, not authored`,
		);
	}
}

function findCycles(byId, err) {
	const WHITE = 0;
	const GREY = 1;
	const BLACK = 2;
	const colour = new Map([...byId.keys()].map((id) => [id, WHITE]));
	const stack = [];
	let found = false;
	const visit = (id) => {
		colour.set(id, GREY);
		stack.push(id);
		for (const d of byId.get(id)?.depends_on ?? []) {
			if (!byId.has(d)) continue;
			if (colour.get(d) === GREY) {
				found = true;
				err(
					`dependency cycle: ${[...stack.slice(stack.indexOf(d)), d].join(" -> ")}`,
				);
			} else if (colour.get(d) === WHITE) {
				visit(d);
			}
		}
		stack.pop();
		colour.set(id, BLACK);
	};
	for (const id of byId.keys()) if (colour.get(id) === WHITE) visit(id);
	return found;
}

/**
 * Returns { errors, warnings }. Structured rather than prefix-tagged so a future message beginning
 * with "WARN " cannot silently downgrade itself to advisory.
 */
export function validateGraph(
	graph,
	{ file = "<graph>", checkSpecSource = true } = {},
) {
	const errors = [];
	const warnings = [];
	const err = (m) => errors.push(m);

	if (graph == null || typeof graph !== "object") {
		return { errors: [`${file}: not a JSON object`], warnings };
	}

	const spec = graph.spec_source;
	validateHeader(graph, { spec, checkSpecSource }, err);

	if (!isArray(graph.nodes))
		return { errors: [...errors, "nodes must be an array"], warnings };
	if (graph.nodes.length === 0) err("nodes must not be empty");

	const byId = new Map();
	for (const n of graph.nodes) {
		if (!n || typeof n !== "object" || !n.id) {
			err("every node needs an id");
			continue;
		}
		if (byId.has(n.id)) err(`duplicate node id: ${n.id}`);
		byId.set(n.id, n);
	}

	const specCriteria = readSpecCriteria(
		checkSpecSource && spec?.endsWith(".md") ? spec : null,
	);
	for (const n of byId.values())
		validateNode(n, { byId, specCriteria, spec }, err);

	const cyclic = findCycles(byId, err);

	// critical_path must resolve AND be a real chain of edges — otherwise it is decoration.
	if (!isArray(graph.critical_path)) {
		err("critical_path must be an array");
	} else {
		for (const id of graph.critical_path) {
			if (!byId.has(id)) err(`critical_path references unknown node ${id}`);
		}
		for (let i = 1; i < graph.critical_path.length; i++) {
			const prev = graph.critical_path[i - 1];
			const cur = byId.get(graph.critical_path[i]);
			if (cur && byId.has(prev) && !(cur.depends_on ?? []).includes(prev)) {
				err(
					`critical_path is not a real edge chain: ${graph.critical_path[i]} does not depend on ${prev}`,
				);
			}
		}
	}

	// Structural checks below assume well-formed arrays and an acyclic graph.
	if (errors.length > 0 || cyclic) return { errors, warnings };

	// Derived parallel-safety: report any independent pair whose write sets collide.
	const reach = transitiveClosure(byId);
	const nodes = [...byId.values()];
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			const a = nodes[i];
			const b = nodes[j];
			if (reach.get(a.id)?.has(b.id) || reach.get(b.id)?.has(a.id)) continue;
			if (setsOverlap(a.write_set, b.write_set)) {
				warnings.push(
					`independent nodes ${a.id} and ${b.id} have overlapping write sets — NOT parallel-safe`,
				);
			}
		}
	}

	return { errors, warnings };
}

/** id -> Set of every node reachable through depends_on. Computed once, not per pair. */
function transitiveClosure(byId) {
	const memo = new Map();
	const walk = (id, seen = new Set()) => {
		if (memo.has(id)) return memo.get(id);
		if (seen.has(id)) return new Set(); // cycle guard: never recurse forever
		seen.add(id);
		const out = new Set();
		for (const d of byId.get(id)?.depends_on ?? []) {
			if (!byId.has(d)) continue;
			out.add(d);
			for (const t of walk(d, seen)) out.add(t);
		}
		memo.set(id, out);
		return out;
	};
	for (const id of byId.keys()) walk(id);
	return memo;
}

// ---------------------------------------------------------------- readiness

export function readyNodes(graph) {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));
	const implementing = graph.nodes.filter((n) => n.status === "IMPLEMENTING");
	return graph.nodes.filter((n) => {
		if (!SELECTABLE.has(n.status)) return false;
		if (!(n.depends_on ?? []).every((d) => byId.get(d)?.status === "VERIFIED"))
			return false;
		// Every declared input must exist. A bare name with no "/" is still a path — treating it as
		// "assume present" let non-existent node outputs pass unchecked.
		if (!(n.inputs ?? []).every((i) => existsSync(i))) return false;
		return !implementing.some((m) =>
			setsOverlap(n.write_set ?? [], m.write_set ?? []),
		);
	});
}

/** Pairs within the READY set that must NOT be built concurrently. */
export function readyConflicts(ready) {
	const out = [];
	for (let i = 0; i < ready.length; i++) {
		for (let j = i + 1; j < ready.length; j++) {
			if (setsOverlap(ready[i].write_set ?? [], ready[j].write_set ?? [])) {
				out.push([ready[i].id, ready[j].id]);
			}
		}
	}
	return out;
}

export function computeCriticalPath(graph) {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));
	const memo = new Map();
	const best = (id, seen = new Set()) => {
		if (memo.has(id)) return memo.get(id);
		if (seen.has(id)) return { chain: [], score: 0 }; // cycle guard
		seen.add(id);
		const n = byId.get(id);
		const w = RISK_WEIGHT[n?.risk] ?? 0;
		let chain = [id];
		let score = w;
		for (const d of n?.depends_on ?? []) {
			const sub = best(d, seen);
			if (
				sub.chain.length + 1 > chain.length ||
				(sub.chain.length + 1 === chain.length && sub.score + w > score)
			) {
				chain = [...sub.chain, id];
				score = sub.score + w;
			}
		}
		seen.delete(id);
		const r = { chain, score };
		memo.set(id, r);
		return r;
	};
	let winner = { chain: [], score: 0 };
	for (const n of graph.nodes) {
		const r = best(n.id);
		if (
			r.chain.length > winner.chain.length ||
			(r.chain.length === winner.chain.length && r.score > winner.score)
		) {
			winner = r;
		}
	}
	return winner.chain;
}

// ---------------------------------------------------------------- reconcile

/**
 * Parse `git status --porcelain -uall -z` output. `-z` disables git's path quoting, which
 * otherwise mangles names containing spaces or non-ASCII (routine in a Spanish-language project).
 * Rename/copy entries put the DESTINATION in the entry and the SOURCE in the next NUL field;
 * both are returned, because a rename also deletes the source.
 */
export function parsePorcelainZ(text) {
	const parts = text.split("\0").filter((s) => s.length > 0);
	const out = [];
	for (let i = 0; i < parts.length; i++) {
		const xy = parts[i].slice(0, 2);
		out.push(parts[i].slice(3));
		if (xy[0] === "R" || xy[0] === "C") {
			i++;
			if (parts[i] !== undefined) out.push(parts[i]);
		}
	}
	return out;
}

export function changedFiles(base) {
	const out = [];
	if (base) {
		const diff = execFileSync(
			"git",
			["diff", "--name-only", "-z", `${base}...HEAD`, "--"],
			{ encoding: "utf8" },
		);
		out.push(...diff.split("\0").filter(Boolean));
	}
	const status = execFileSync("git", ["status", "--porcelain", "-uall", "-z"], {
		encoding: "utf8",
	});
	out.push(...parsePorcelainZ(status));
	return [...new Set(out)].filter((p) => p && !p.endsWith("/"));
}

export function reconcile(graph, changed, nodeId = null) {
	const scope = nodeId
		? graph.nodes.filter((n) => n.id === nodeId)
		: graph.nodes;
	const declared = [...new Set(scope.flatMap((n) => n.write_set ?? []))];
	const unexplained = changed.filter((f) => !matchesAny(f, declared));
	const untouched = declared.filter(
		(g) => !changed.some((f) => globToRegExp(g).test(f)),
	);
	return { unexplained, untouched, declared, changed };
}

// ---------------------------------------------------------------- cli

export function parseCliArgs(args) {
	const wantReady = args.includes("--ready");
	const wantReconcile = args.includes("--reconcile");
	if (wantReady && wantReconcile) {
		return { error: "--ready and --reconcile are mutually exclusive" };
	}
	const mode = wantReady ? "ready" : wantReconcile ? "reconcile" : "validate";

	const valueFlags = new Set(["--base", "--node"]);
	const values = {};
	const files = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (valueFlags.has(a)) {
			const v = args[i + 1];
			if (v === undefined) return { error: `${a} requires a value` };
			// Guard against argv injection: `--base --output=/path` would reach git's own option
			// parser and write an arbitrary file. execFileSync avoids a shell, not git's parser.
			if (v.startsWith("-"))
				return { error: `${a} value may not start with "-" (got ${v})` };
			values[a.slice(2)] = v;
			i++;
		} else if (a === "--ready" || a === "--reconcile") {
			// mode flags, already handled
		} else if (a.startsWith("-")) {
			// Silently ignoring an unknown flag meant `--reconcille` (typo) exited 0 having
			// reconciled nothing, while looking like the gate had run.
			return { error: `unknown option ${a}` };
		} else {
			files.push(a);
		}
	}
	if (mode !== "reconcile" && (values.base || values.node)) {
		return { error: "--base and --node are only valid with --reconcile" };
	}
	return { mode, base: values.base ?? null, node: values.node ?? null, files };
}

function reportReady(graph) {
	const ready = readyNodes(graph);
	console.log(
		`  critical path: ${computeCriticalPath(graph).join(" -> ") || "(none)"}`,
	);
	console.log(
		`  READY (${ready.length}): ${ready.map((n) => `${n.id} [${n.risk}]`).join(", ") || "(none)"}`,
	);
	for (const [a, b] of readyConflicts(ready)) {
		console.log(
			`  ⚠ ${a} and ${b} share a write set — do NOT build them concurrently`,
		);
	}
	console.log(
		"  note: readiness assumes the spec is human-approved — that gate is outside this file.",
	);
}

function reportReconcile(graph, file, { base, node }) {
	if (node && !graph.nodes.some((n) => n.id === node)) {
		console.error(`✗ ${file}: --node ${node} is not a node in this graph`);
		return false;
	}
	const changed = changedFiles(base);
	// A clean tree with no base examined nothing. Returning green there lets the last gate before
	// VERIFIED be satisfied simply by committing first.
	if (changed.length === 0 && !base) {
		console.error(
			`✗ ${file}: nothing to reconcile — the working tree is clean and no --base was given.`,
		);
		console.error(
			"  Pass --base <ref> (e.g. the commit the task branched from) so the check examines a real range.",
		);
		return false;
	}
	const { unexplained, untouched } = reconcile(graph, changed, node);
	console.log(
		`  scope: ${node ?? "whole graph"} · ${changed.length} changed file(s)${base ? ` (base ${base})` : " (working tree)"}`,
	);
	if (untouched.length > 0) {
		console.log(
			`  declared but not touched (${untouched.length}): ${untouched.join(", ")}`,
		);
	}
	if (unexplained.length > 0) {
		for (const f of unexplained) {
			console.error(
				`✗ ${file}: UNEXPLAINED SCOPE — ${f} is in no ${node ? `${node} ` : ""}write_set`,
			);
		}
		return false;
	}
	console.log(
		"  ✓ no unexplained scope — every changed file is in a declared write_set",
	);
	return true;
}

function main(argv) {
	const parsed = parseCliArgs(argv.slice(2));
	if (parsed.error) {
		console.error(`✗ ${parsed.error}`);
		return 2;
	}
	const { mode, base, node, files } = parsed;

	if (files.length === 0) {
		console.error(
			"usage: validate-task-graph.mjs [--ready | --reconcile [--base <ref>] [--node <id>]] <graph.json>...",
		);
		return 2;
	}

	let failed = false;
	for (const file of files) {
		if (!existsSync(file)) {
			console.error(`✗ ${file}: not found`);
			failed = true;
			continue;
		}
		let graph;
		try {
			graph = JSON.parse(readFileSync(file, "utf8"));
		} catch (e) {
			console.error(`✗ ${file}: invalid JSON — ${e.message}`);
			failed = true;
			continue;
		}

		const { errors, warnings } = validateGraph(graph, { file });
		for (const w of warnings) console.warn(`⚠ ${file}: ${w}`);
		for (const p of errors) console.error(`✗ ${file}: ${p}`);
		if (errors.length > 0) {
			failed = true;
			continue;
		}
		console.log(
			`✓ ${file}: ${graph.nodes.length} nodes, no cycles, all nodes explained and checkable`,
		);

		try {
			if (mode === "ready") reportReady(graph);
			if (
				mode === "reconcile" &&
				!reportReconcile(graph, file, { base, node })
			) {
				failed = true;
			}
		} catch (e) {
			console.error(`✗ ${file}: ${mode} failed — ${e.message}`);
			failed = true;
		}
	}
	return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	process.exit(main(process.argv));
}
