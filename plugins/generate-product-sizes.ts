/**
 * generate-product-sizes.ts
 * Generates three size variants for product images.
 *
 * Input:  pages/assets/images/products/<id>/<variant>/<file>.webp
 * Output: pages/assets/images/products/detail/<id>/<variant>/<file>.webp  → 800px inside
 *         pages/assets/images/products/card/<id>/<variant>/<file>.webp    → 360px inside
 *         pages/assets/images/products/thumb/<id>/<variant>/<file>.webp   → 80×80px cover
 *
 * Skips source directories: detail/, card/, thumb/ — output only.
 * Skips already existing output files — re-run is safe.
 *
 * Usage: npm run images:products
 */

import { mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import sharp from "sharp";

const PROJECT_ROOT = process.cwd();
const PRODUCTS_DIR = join(PROJECT_ROOT, "pages", "assets", "images", "products");
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const QUALITY = 82;

// ─── Size variants ────────────────────────────────────────────────────────────

interface SizeVariant {
	name: string;
	width: number;
	height?: number;
	fit: "inside" | "cover";
}

const SIZES: SizeVariant[] = [
	{ name: "detail", width: 800, fit: "inside" },
	{ name: "card", width: 360, fit: "inside" },
	{ name: "thumb", width: 80, height: 80, fit: "cover" },
];

// Output dir names — skip when walking source
const OUTPUT_DIRS = new Set(SIZES.map((s) => s.name));

// ─── File walker ──────────────────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const results: string[] = [];

	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			// Skip output directories — sources only
			if (OUTPUT_DIRS.has(entry.name)) continue;
			results.push(...(await walk(full)));
		} else if (IMAGE_EXT.test(entry.name)) {
			results.push(full);
		}
	}

	return results;
}

// ─── Process single file ──────────────────────────────────────────────────────

type Result = "generated" | "skipped" | "failed";

async function processFile(src: string): Promise<Result[]> {
	// Relative path from PRODUCTS_DIR: e.g. "l4/front/l4-front-1.webp"
	const rel = relative(PRODUCTS_DIR, src);
	const results: Result[] = [];

	for (const size of SIZES) {
		const dest = join(PRODUCTS_DIR, size.name, rel);

		// Skip if already exists — re-run safe
		try {
			await readdir(dirname(dest));
			const existing = await readdir(dirname(dest));
			if (existing.includes(dest.split(/[\\/]/).pop()!)) {
				results.push("skipped");
				continue;
			}
		} catch {
			// dir doesn't exist yet — will be created
		}

		try {
			await mkdir(dirname(dest), { recursive: true });

			await sharp(src)
				.resize({
					width: size.width,
					height: size.height,
					fit: size.fit,
					withoutEnlargement: true,
				})
				.webp({ quality: QUALITY })
				.toFile(dest);

			const label = size.height ? `${size.width}×${size.height}px ${size.fit}` : `${size.width}px ${size.fit}`;

			console.log(`  ✓ ${size.name}/${rel} → ${label}`);
			results.push("generated");
		} catch (err) {
			console.error(`  ✗ ${size.name}/${rel} — ${(err as Error).message}`);
			results.push("failed");
		}
	}

	return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const files = await walk(PRODUCTS_DIR);

	if (files.length === 0) {
		console.log("No source images found in products/.");
		return;
	}

	console.log(`Found ${files.length} source image(s) — generating ${SIZES.length} sizes each...\n`);

	const allResults = (await Promise.all(files.map(processFile))).flat();

	const generated = allResults.filter((r) => r === "generated").length;
	const skipped = allResults.filter((r) => r === "skipped").length;
	const failed = allResults.filter((r) => r === "failed").length;

	console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed. Quality: ${QUALITY}.`);
}

main();
