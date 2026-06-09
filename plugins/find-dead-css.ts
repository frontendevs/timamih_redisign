/**
 * find-dead-css.ts
 * Finds CSS classes defined in stylesheets but not referenced in HTML or JS/TS.
 *
 * Usage: vite-node plugins/find-dead-css.ts
 *
 * What it checks:
 *   - pages/**\/*.css  → extracts class selectors
 *   - pages/**\/*.html → extracts class="..." attributes
 *   - pages/**\/*.ts   → extracts classList, className, is-* strings
 *
 * What it intentionally ignores:
 *   - State classes (is-*, data-state) — added dynamically by JS
 *   - Pseudo-classes (:hover, :focus etc.) — stripped automatically
 *   - Vendor / node_modules / dist
 *
 * Output:
 *   - Suspected dead classes with the CSS file they came from
 *   - Exit code 0 always — informational only, never blocks CI
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const PROJECT_ROOT = process.cwd();
const PAGES_DIR = join(PROJECT_ROOT, "pages");

// ─── Config ──────────────────────────────────────────────────────────────────

// Classes matching these patterns are always considered "used" —
// they are set dynamically in JS and won't appear in static HTML.
const DYNAMIC_PATTERNS: RegExp[] = [
	/^is-/, // state classes: is-active, is-open, is-loading ...
	/^has-/, // compound state: has-error, has-items ...
	/^js-/, // legacy js- hooks (if any)
];

// Directories to skip entirely
const IGNORE_DIRS = new Set(["node_modules", "dist", "vendor", "public", ".claude", "components"]);

// ─── File walker ──────────────────────────────────────────────────────────────

async function walk(dir: string, exts: string[]): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const results: string[] = [];
	for (const entry of entries) {
		if (IGNORE_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await walk(full, exts)));
		} else if (exts.includes(extname(entry.name))) {
			results.push(full);
		}
	}
	return results;
}

// ─── Extractors ───────────────────────────────────────────────────────────────

/**
 * Extract class names defined in CSS selectors.
 * Returns a map: className → Set of source files.
 */
function extractCssClasses(content: string, file: string): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();

	// Strip comments, @import, url() and var() — they contain dashes that look like class selectors
	const stripped = content
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/@import\s+[^;]+;/g, "")
		.replace(/var\s*\([^)]+\)/g, "var()")
		.replace(/url\s*\([^)]*\)/gi, "url()");

	// Match class selectors: .foo, .foo-bar, .foo__bar (but not :pseudo or combined)
	const selectorPattern = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
	let match: RegExpExecArray | null;

	while ((match = selectorPattern.exec(stripped)) !== null) {
		const cls = match[1];
		if (!cls) continue;
		let files = map.get(cls);
		if (!files) {
			files = new Set();
			map.set(cls, files);
		}
		files.add(file);
	}

	return map;
}

/**
 * Extract class names referenced in HTML (class="..." attributes).
 */
function extractHtmlClasses(content: string): Set<string> {
	const classes = new Set<string>();
	const attrPattern = /class\s*=\s*["']([^"']+)["']/g;
	let match: RegExpExecArray | null;

	while ((match = attrPattern.exec(content)) !== null) {
		const raw = match[1];
		if (!raw) continue;
		for (const cls of raw.split(/\s+/)) {
			if (cls) classes.add(cls);
		}
	}

	return classes;
}

/**
 * Extract class names referenced in JS/TS:
 *   - classList.add/remove/toggle/contains('foo')
 *   - className = 'foo'
 *   - dataset.state references indirectly (skip — not class-based)
 *   - string literals that look like class names inside template literals
 */
function extractJsClasses(content: string): Set<string> {
	const classes = new Set<string>();

	// classList.add('foo', 'bar') / classList.remove / toggle / contains
	const classListPattern = /classList\.\w+\(\s*["'`]([^"'`]+)["'`]/g;
	let match: RegExpExecArray | null;
	while ((match = classListPattern.exec(content)) !== null) {
		const raw = match[1];
		if (!raw) continue;
		for (const cls of raw.split(/\s+/)) {
			if (cls) classes.add(cls);
		}
	}

	// className = 'foo bar'
	const classNamePattern = /className\s*[+=]+\s*["'`]([^"'`]+)["'`]/g;
	while ((match = classNamePattern.exec(content)) !== null) {
		const raw = match[1];
		if (!raw) continue;
		for (const cls of raw.split(/\s+/)) {
			if (cls) classes.add(cls);
		}
	}

	// String literals that look exactly like a CSS class name: 'is-active', "card-header"
	const stringLiteralPattern = /["'`]([a-z][a-z0-9-]{1,40})["'`]/g;
	while ((match = stringLiteralPattern.exec(content)) !== null) {
		const cls = match[1];
		if (cls) classes.add(cls);
	}

	return classes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const [cssFiles, htmlFiles, tsFiles] = await Promise.all([
		walk(PAGES_DIR, [".css"]),
		walk(PAGES_DIR, [".html"]),
		walk(PAGES_DIR, [".ts", ".js"]),
	]);

	// Collect all CSS-defined classes: className → source files
	const cssClasses = new Map<string, Set<string>>();

	for (const file of cssFiles) {
		const content = await readFile(file, "utf-8");
		for (const [cls, files] of extractCssClasses(content, file)) {
			let sources = cssClasses.get(cls);
			if (!sources) {
				sources = new Set();
				cssClasses.set(cls, sources);
			}
			for (const f of files) sources.add(f);
		}
	}

	// Collect all used classes from HTML and JS/TS
	const usedClasses = new Set<string>();

	for (const file of htmlFiles) {
		const content = await readFile(file, "utf-8");
		for (const cls of extractHtmlClasses(content)) usedClasses.add(cls);
	}

	for (const file of tsFiles) {
		const content = await readFile(file, "utf-8");
		for (const cls of extractJsClasses(content)) usedClasses.add(cls);
	}

	// Find candidates: defined in CSS, not found in HTML/JS, not dynamic
	const dead: Array<{ cls: string; files: string[] }> = [];

	for (const [cls, files] of cssClasses) {
		if (usedClasses.has(cls)) continue;
		if (DYNAMIC_PATTERNS.some((p) => p.test(cls))) continue;
		dead.push({ cls, files: [...files] });
	}

	// ─── Report ───────────────────────────────────────────────────────────────

	console.log(`\nCSS files scanned:  ${cssFiles.length}`);
	console.log(`HTML files scanned: ${htmlFiles.length}`);
	console.log(`JS/TS files scanned: ${tsFiles.length}`);
	console.log(`CSS classes found:  ${cssClasses.size}`);
	console.log(`Classes in use:     ${usedClasses.size}\n`);

	if (dead.length === 0) {
		console.log("✓ No suspected dead classes found.");
		return;
	}

	console.log(`⚠ Suspected dead classes: ${dead.length}`);
	console.log("────────────────────────────────────────────────");
	console.log("These classes appear in CSS but were not found in HTML or JS/TS.");
	console.log("Verify manually — dynamic classes may produce false positives.\n");

	// Group by source file for readability
	const byFile = new Map<string, string[]>();
	for (const { cls, files } of dead) {
		for (const file of files) {
			const rel = relative(PROJECT_ROOT, file).replace(/\\/g, "/");
			let classes = byFile.get(rel);
			if (!classes) {
				classes = [];
				byFile.set(rel, classes);
			}
			classes.push(cls);
		}
	}

	for (const [file, classes] of [...byFile].sort()) {
		console.log(`  ${file}`);
		for (const cls of classes.sort()) {
			console.log(`    .${cls}`);
		}
	}

	console.log("\n─ Tip: add to DYNAMIC_PATTERNS in find-dead-css.ts to suppress false positives.");
}

main().catch((err) => {
	console.error("find-dead-css error:", err);
	process.exit(1);
});
