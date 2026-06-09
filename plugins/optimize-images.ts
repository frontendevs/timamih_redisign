/**
 * One-time image optimization script.
 * Converts PNG/JPG → WebP in-place, resizes by path convention.
 *
 * Image directory convention:
 *
 *   images/
 *     products/
 *       <item-name>/
 *         thumb.webp    →  80×80px  cover  (cart, search, wishlist)
 *         card.webp     →  400px    inside (catalog grid)
 *         detail.webp   →  800px    inside (product page)
 *     blog/
 *       <post-slug>/
 *         thumb.webp    →  400px    inside (post list)
 *         cover.webp    →  1200px   inside (post header)
 *     background/
 *       <name>.webp     →  1920px   inside (hero, section backgrounds)
 *
 * Files not matching any rule are converted to WebP at original dimensions.
 * Already-optimized WebP files without a matching rule are skipped.
 *
 * Usage: npm run images:optimize
 */

import { readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const PROJECT_ROOT = process.cwd();
const IMAGES_DIR = join(PROJECT_ROOT, "pages", "assets", "images");
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const QUALITY = 82;

// ─── Resize rules ─────────────────────────────────────────────────────────────
// Match is checked against the normalized (lowercase, forward-slash) file path.
// More specific matches must come before broader ones — find() takes the first hit.
// fit: "cover"  — crops to exact dimensions (use for fixed-ratio thumbnails)
// fit: "inside" — preserves aspect ratio, fits within box (default for most cases)

interface ResizeRule {
	match: string;
	width?: number;
	height?: number;
	fit?: "cover" | "contain" | "inside";
}

const RESIZE_RULES: ResizeRule[] = [
	// Products — three sizes per item, matched by filename
	{ match: "products/thumb.", width: 80, height: 80, fit: "cover" },
	{ match: "products/card.", width: 400, fit: "inside" },
	{ match: "products/detail.", width: 800, fit: "inside" },

	// Blog
	{ match: "blog/thumb.", width: 400, fit: "inside" },
	{ match: "blog/cover.", width: 1200, fit: "inside" },

	// Backgrounds
	{ match: "background/", width: 1920, fit: "inside" },
];

// ─── File walker ──────────────────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const results: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await walk(full)));
		} else {
			results.push(full);
		}
	}
	return results;
}

// ─── Label helper ─────────────────────────────────────────────────────────────

function ruleLabel(rule: ResizeRule): string {
	if (rule.width && rule.height) return ` → ${rule.width}×${rule.height}px ${rule.fit ?? "inside"}`;
	if (rule.width) return ` → ${rule.width}px`;
	if (rule.height) return ` → ×${rule.height}px`;
	return "";
}

// ─── Process single file ──────────────────────────────────────────────────────

type Result = "converted" | "skipped" | "failed";

async function processFile(src: string): Promise<Result> {
	const normalizedSrc = src.replace(/\\/g, "/").toLowerCase();
	const isWebP = normalizedSrc.endsWith(".webp");
	const rule = RESIZE_RULES.find((r) => normalizedSrc.includes(r.match.toLowerCase()));

	// Already WebP with no resize rule — nothing to do
	if (isWebP && !rule) return "skipped";

	const dest = `${src.slice(0, src.lastIndexOf("."))}.webp`;
	const tmp = `${dest}.tmp.webp`;

	try {
		const pipeline = sharp(src);

		if (rule) {
			pipeline.resize({
				width: rule.width,
				height: rule.height,
				fit: rule.fit ?? "inside",
				withoutEnlargement: true,
			});
		}

		// Write to temp first — safe in-place replacement for WebP source files
		const out = isWebP ? tmp : dest;
		await pipeline.webp({ quality: QUALITY }).toFile(out);
		await unlink(src);
		if (isWebP) await rename(tmp, dest);

		const shortPath = normalizedSrc.split("images/")[1] ?? src;
		console.log(`  ✓ ${shortPath}${rule ? ruleLabel(rule) : ""}`);
		return "converted";
	} catch (err) {
		await unlink(tmp).catch(() => {});
		console.error(`  ✗ ${src} — ${(err as Error).message}`);
		return "failed";
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const files = (await walk(IMAGES_DIR)).filter((f) => IMAGE_EXT.test(f));

	if (files.length === 0) {
		console.log("No images found.");
		return;
	}

	console.log(`Found ${files.length} image(s) — processing...\n`);

	const results = await Promise.all(files.map(processFile));

	const converted = results.filter((r) => r === "converted").length;
	const failed = results.filter((r) => r === "failed").length;

	console.log(`\nDone: ${converted} converted, ${failed} failed. Quality: ${QUALITY}.`);
}

main();
