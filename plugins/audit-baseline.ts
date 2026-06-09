/**
 * audit-baseline.ts
 * Cross-checks web-platform features mentioned in skills against live Baseline
 * status from the `web-features` data package (W3C WebDX, tracked in devDeps;
 * `npm update web-features` refreshes the data, lockfile keeps installs stable).
 *
 * Goal: catch a skill that teaches a limited/newly feature WITHOUT a nearby
 * progressive-enhancement / fallback gate — the exact drift the KILLCRITIC loop
 * is supposed to prevent (CLAUDE.md: "не утверждать Baseline-факты по памяти").
 *
 * Usage:
 *   vite-node plugins/audit-baseline.ts            # findings without a PE gate
 *   vite-node plugins/audit-baseline.ts --all      # every match, gated or not
 *   vite-node plugins/audit-baseline.ts --limited  # only baseline:false (drop newly)
 *
 * Status vocabulary (from web-features `status.baseline`):
 *   false  → "limited"  — not Baseline. Needs a gate on a broad audience.
 *   "low"  → "newly"    — Baseline newly available (<30mo). Gate on conservative targets.
 *   "high" → "widely"   — Baseline widely available. Ignored here.
 *
 * Method is a HEURISTIC name-match, not a parser — verify findings manually.
 * Source of truth for status is the data package, never this file.
 *
 * Output: grouped by feature, with skill:line and whether a gate sits nearby.
 * Exit code 0 always — informational, never blocks CI.
 */

import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { features } from "web-features";

const PROJECT_ROOT = process.cwd();
const SKILLS_DIR = join(PROJECT_ROOT, ".claude", "skills");
// web-features blocks "./package.json" via exports — read it off disk instead.
const WF_VERSION: string = JSON.parse(
	readFileSync(join(PROJECT_ROOT, "node_modules", "web-features", "package.json"), "utf-8"),
).version;

// ─── Config ──────────────────────────────────────────────────────────────────

const ARGS = new Set(process.argv.slice(2));
const SHOW_ALL = ARGS.has("--all"); // include gated matches in the report
const LIMITED_ONLY = ARGS.has("--limited"); // drop "newly" (low), keep only false

// A match is gated if a caveat appears anywhere in its MARKDOWN SECTION (between
// the enclosing headings), not within a fixed line radius — skills often place
// the support note at the end of the section ("Freshness: …"), far from the
// first mention. A fixed radius missed those and produced noise.

// A nearby mention of any of these means the skill already frames the feature
// as conditional — not a finding. Skills teach in Russian, so the gate
// vocabulary is bilingual: EN technical terms + RU support-caveat phrasing
// actually used across the skills ("Поддержка:", "сверять support",
// "прогрессивное улучшение", "не поддерживает", "Chrome-only", "blocker").
const GATE_PATTERN =
	/@supports|CSS\.supports|fallback|progressive|polyfill|graceful|feature[\s-]?detect|baseline|not (yet )?widely|limited (availability|support)|@font-feature|\bPE gate\b|freshness|stage-\d|шиппинг|поддержк|сверя|прогрессивн|экспериментальн|осторожн|blocker|chrome-only/i;

// Single-word feature names ("function", "selection", "container") collide with
// ordinary prose and flood the report. So a match must be a MULTI-WORD phrase
// ("anchor positioning", "scroll-driven animations") — which is exactly the
// shape of the modern Baseline frontier — UNLESS the single token is a coined,
// unambiguous term explicitly allowed below.
const SINGLE_WORD_ALLOW = new Set([
	"subgrid",
	"popover",
	"masonry",
	"sanitizer", // extend as distinctive 1-word features appear
]);

// Multi-word phrases to suppress: too foundational to flag, or a name collision.
const STOP_ALIASES = new Set([
	"grid layout",
	"custom properties",
	"media queries",
	"css transitions",
	"css animations",
	"cascade layers",
	// web-features id "css-modules" is named "CSS import attributes" (import CSS
	// as a module). Its "css modules" alias collides with build-time CSS Modules.
	"css modules",
	// "light-dark" → "light dark" collides with the `color-scheme: light dark`
	// value; the real function is written light-dark( with a paren.
	"light dark",
]);

// ─── Feature index ────────────────────────────────────────────────────────────

type Tier = "limited" | "newly";

interface TrackedFeature {
	id: string;
	name: string;
	tier: Tier;
	date?: string; // baseline_low_date when newly
	aliases: string[]; // normalized, lowercase search terms
}

/** Turn a feature id ("anchor-positioning") + name into lowercase search aliases. */
function buildAliases(id: string, name: string): string[] {
	const raw = [name, id.replace(/-/g, " ")];
	const out = new Set<string>();
	for (const a of raw) {
		const norm = a.toLowerCase().trim();
		if (STOP_ALIASES.has(norm)) continue;
		const multiWord = /\s/.test(norm);
		if (!multiWord && !SINGLE_WORD_ALLOW.has(norm)) continue; // drop generic 1-word names
		out.add(norm);
	}
	return [...out];
}

function collectTrackedFeatures(): TrackedFeature[] {
	const tracked: TrackedFeature[] = [];
	for (const [id, data] of Object.entries(features)) {
		// Skip "moved"/"split" redirect records — only real features carry status.
		if (!("status" in data)) continue;
		const baseline = data.status?.baseline;
		let tier: Tier | null = null;
		if (baseline === false) tier = "limited";
		else if (baseline === "low") tier = "newly";
		if (!tier) continue;
		if (LIMITED_ONLY && tier !== "limited") continue;

		const aliases = buildAliases(id, data.name);
		if (aliases.length === 0) continue;

		const date = data.status?.baseline_low_date;
		tracked.push({
			id,
			name: data.name,
			tier,
			aliases,
			...(date ? { date } : {}),
		});
	}
	return tracked;
}

// ─── File walker ──────────────────────────────────────────────────────────────

async function walkMarkdown(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const results: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) results.push(...(await walkMarkdown(full)));
		else if (entry.name.endsWith(".md")) results.push(full);
	}
	return results;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

interface Hit {
	file: string; // relative, forward slashes
	line: number; // 1-based
	gated: boolean;
}

/** Escape a literal alias for use inside a RegExp. */
function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Line indices of real markdown headings, ignoring `#` inside fenced code blocks
 * (shell comments, `# step` in examples) — those are not section boundaries.
 */
function headingLines(lines: string[]): number[] {
	const heads: number[] = [];
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (!inFence && /^#{1,6}\s/.test(line)) heads.push(i);
	}
	return heads;
}

/** [start, end) line range of the section containing line `i`. */
function sectionBounds(heads: number[], i: number, total: number): [number, number] {
	let from = 0;
	let to = total;
	for (const h of heads) {
		if (h <= i) from = h;
		else {
			to = h;
			break;
		}
	}
	return [from, to];
}

function scanFile(relPath: string, lines: string[], heads: number[], feature: TrackedFeature): Hit[] {
	const patterns = feature.aliases.map((a) => new RegExp(`\\b${escapeRe(a)}\\b`, "i"));
	const hits: Hit[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (!patterns.some((p) => p.test(line))) continue;

		const [from, to] = sectionBounds(heads, i, lines.length);
		const context = lines.slice(from, to).join("\n");
		hits.push({ file: relPath, line: i + 1, gated: GATE_PATTERN.test(context) });
	}
	return hits;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const tracked = collectTrackedFeatures();
	const skillFiles = await walkMarkdown(SKILLS_DIR);

	// feature id → its hits across all skill files
	const findings = new Map<string, { feature: TrackedFeature; hits: Hit[] }>();

	for (const file of skillFiles) {
		const content = await readFile(file, "utf-8");
		const lines = content.split(/\r?\n/);
		const heads = headingLines(lines);
		const rel = relative(PROJECT_ROOT, file).replace(/\\/g, "/");

		for (const feature of tracked) {
			const hits = scanFile(rel, lines, heads, feature);
			if (hits.length === 0) continue;
			let entry = findings.get(feature.id);
			if (!entry) {
				entry = { feature, hits: [] };
				findings.set(feature.id, entry);
			}
			entry.hits.push(...hits);
		}
	}

	// ─── Report ────────────────────────────────────────────────────────────────

	const tierLabel: Record<Tier, string> = {
		limited: "limited  (not Baseline)",
		newly: "newly    (Baseline <30mo)",
	};

	console.log(`\nweb-features:        v${WF_VERSION}`);
	console.log(`Tracked features:    ${tracked.length} (limited + newly)`);
	console.log(`Skill files scanned: ${skillFiles.length}`);
	console.log(`Features mentioned:  ${findings.size}\n`);

	// Decide what to print: ungated matches by default, everything with --all.
	const report = [...findings.values()]
		.map(({ feature, hits }) => ({
			feature,
			hits: SHOW_ALL ? hits : hits.filter((h) => !h.gated),
		}))
		.filter((r) => r.hits.length > 0)
		// limited before newly, then alphabetically
		.sort(
			(a, b) =>
				Number(a.feature.tier === "newly") - Number(b.feature.tier === "newly") ||
				a.feature.name.localeCompare(b.feature.name),
		);

	if (report.length === 0) {
		console.log("✓ No limited/newly feature is taught without a nearby PE gate.");
		return;
	}

	const heading = SHOW_ALL
		? `All limited/newly features mentioned: ${report.length}`
		: `⚠ limited/newly features taught WITHOUT a nearby gate: ${report.length}`;
	console.log(heading);
	console.log("────────────────────────────────────────────────");
	console.log("Heuristic name-match — verify each manually before acting.\n");

	for (const { feature, hits } of report) {
		const date = feature.date ? ` since ${feature.date}` : "";
		console.log(`  ${feature.name}  [${tierLabel[feature.tier]}${date}]`);
		for (const h of hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
			const flag = SHOW_ALL ? (h.gated ? "  ✓ gated" : "  ✗ no gate") : "";
			console.log(`    ${h.file}:${h.line}${flag}`);
		}
		console.log("");
	}

	console.log("─ A gate = nearby @supports / fallback / 'Baseline' / 'not widely' / PE note.");
	console.log("─ Tune GATE_PATTERN, STOP_ALIASES, or SINGLE_WORD_ALLOW to cut noise.");
}

main().catch((err) => {
	console.error("audit-baseline error:", err);
	process.exit(1);
});
