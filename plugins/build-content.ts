/**
 * plugins/build-content.ts
 * Prebuild orchestrator: JSON content → HTML pages.
 *
 * Generates:
 *   pages/index.html          (en)
 *   pages/ru/index.html       (ru)
 *   pages/fi/index.html       (fi)
 *   pages/404.html            (en, links to all 3 locales)
 *   public/sitemap.xml        (3 canonical URLs)
 *
 * Run: vite-node plugins/build-content.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { esc } from "./content/html.ts";
import { renderPage } from "./content/render.ts";
import { loadContent, type Locale } from "./content/schema.ts";

const ROOT = join(import.meta.dirname, "..");
const PAGES = join(ROOT, "pages");
const PUBLIC = join(ROOT, "public");

function write(filePath: string, content: string): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf-8");
	console.log(`  [prebuild] wrote: ${filePath.replace(ROOT, "")}`);
}

// ── 404 page ─────────────────────────────────────────────────────────────────

function render404(): string {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page not found — TimaMih</title>
    <meta name="robots" content="noindex" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/assets/css/core.css" />
    <link rel="stylesheet" href="/index/css/index.css" />
  </head>
  <body>
    <main class="not-found-page">
      <div class="not-found-inner">
        <h1 class="not-found-title">404</h1>
        <p class="not-found-message">Page not found</p>
        <nav aria-label="Available languages">
          <ul role="list" class="not-found-links">
            <li><a href="/">English</a></li>
            <li><a href="/ru/">Русский</a></li>
            <li><a href="/fi/">Suomi</a></li>
          </ul>
        </nav>
      </div>
    </main>
  </body>
</html>`;
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

function renderSitemap(): string {
	const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
	const urls = [
		{ loc: "https://timamih.com/", priority: "1.0" },
		{ loc: "https://timamih.com/ru/", priority: "0.9" },
		{ loc: "https://timamih.com/fi/", priority: "0.9" },
	];

	const urlEntries = urls
		.map(
			(u) =>
				`  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${now}</lastmod>
    <priority>${u.priority}</priority>
  </url>`,
		)
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	console.log("[prebuild] Starting content build...\n");

	const locales: Locale[] = ["en", "ru", "fi"];

	for (const locale of locales) {
		console.log(`[prebuild] Processing locale: ${locale}`);
		const content = loadContent(locale);
		const html = renderPage(content);

		const outPath = locale === "en" ? join(PAGES, "index.html") : join(PAGES, locale, "index.html");

		write(outPath, html);
	}

	// 404
	write(join(PAGES, "404.html"), render404());

	// Sitemap
	write(join(PUBLIC, "sitemap.xml"), renderSitemap());

	console.log("\n[prebuild] Done.");
}

main().catch((err: unknown) => {
	console.error("[prebuild] ERROR:", err);
	process.exit(1);
});
