/**
 * plugins/content/head.ts
 * Generates the full <head> element for each locale.
 *
 * Covers: charset, viewport, title, description, canonical, hreflang,
 * OG (BCP-47 locale), favicon, font preload, stylesheets,
 * JSON-LD, inline anti-flash theme script.
 */

import { attr, esc } from "./html.ts";
import type { Locale, PageContent } from "./schema.ts";
import { buildSchemaOrg } from "./schemaOrg.ts";

// ── BCP-47 locale map ─────────────────────────────────────────────────────────
const BCP47: Record<Locale, string> = {
	en: "en_US",
	ru: "ru_RU",
	fi: "fi_FI",
};

// ── Canonical URL helpers ─────────────────────────────────────────────────────
const BASE_URL = "https://timamih.com";

function canonicalUrl(locale: Locale): string {
	if (locale === "en") return `${BASE_URL}/`;
	return `${BASE_URL}/${locale}/`;
}

// ── Anti-flash inline theme script ───────────────────────────────────────────
// Runs synchronously before first paint. Reads localStorage; default = "light".
const ANTI_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

// ── OG image — TODO: replace with real OG image once asset exists ─────────────
const OG_IMAGE = "/assets/images/og/og-16x9.webp"; // TODO: create this asset

export function renderHead(content: PageContent): string {
	const { locale, site } = content;
	const title = `${esc(site.seo.title)}`;
	const description = esc(site.seo.description);
	const canonical = canonicalUrl(locale);
	const ogLocale = BCP47[locale];

	// hreflang alternates
	const hreflang = `
    <link rel="alternate" hreflang="en" href="${attr(`${BASE_URL}/`)}" />
    <link rel="alternate" hreflang="ru" href="${attr(`${BASE_URL}/ru/`)}" />
    <link rel="alternate" hreflang="fi" href="${attr(`${BASE_URL}/fi/`)}" />
    <link rel="alternate" hreflang="x-default" href="${attr(`${BASE_URL}/`)}" />`.trim();

	const schemaOrg = buildSchemaOrg(content);

	return `<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Anti-flash theme (inline, sync, must be first script) -->
    <script>${ANTI_FLASH_SCRIPT}</script>

    <!-- SEO -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${attr(canonical)}" />

    <!-- hreflang -->
    ${hreflang}

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${attr(canonical)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:locale" content="${attr(ogLocale)}" />
    <meta property="og:site_name" content="${esc(site.siteName)}" />
    <!-- TODO: add OG image once /assets/images/og/og-16x9.webp is created -->
    <!-- <meta property="og:image" content="${attr(`${BASE_URL}${OG_IMAGE}`)}" /> -->

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <!-- Fonts — Rubik self-hosted woff2 -->
    <link rel="preload" href="/assets/fonts/Rubik-Regular.woff2" as="font" type="font/woff2" crossorigin />

    <!-- Stylesheets -->
    <link rel="stylesheet" href="/assets/css/core.css" />
    <link rel="stylesheet" href="/index/css/index.css" />

    <!-- JSON-LD -->
    ${schemaOrg}
  </head>`;
}
