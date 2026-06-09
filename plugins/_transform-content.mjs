#!/usr/bin/env node
/**
 * _transform-content.mjs
 * One-shot transformer: DatoCMS raw JSON → structured content/ files.
 *
 * Run: node plugins/_transform-content.mjs
 *
 * Outputs:
 *   content/team.json
 *   content/{en,ru,fi}/{site,navigation,hero,how-we-work,what-we-offer,our-little-story,get-in-touch}.json
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert "First Last" → "first-last" slug */
function slugify(name) {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-");
}

/**
 * Extract avatar filename from DatoCMS URL.
 * URL pattern: https://www.datocms-assets.com/71846/<timestamp>-<filename>
 * We strip the leading digits+dash prefix to get the normalized filename.
 */
function avatarFilename(url) {
	if (!url) return null;
	const base = url.split("/").pop(); // e.g. "1657817162-igor_ivanov.webp"
	// Remove leading numeric prefix (timestamp)
	return base.replace(/^\d+-/, "");
}

function write(filePath, data) {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
	console.log("  wrote:", filePath.replace(root, ""));
}

// ── Load raw data ─────────────────────────────────────────────────────────────

const raw = {};
for (const locale of ["en", "ru", "fi"]) {
	const src = join(root, "content/_raw", `dato-${locale}.json`);
	raw[locale] = JSON.parse(readFileSync(src, "utf-8"));
}

// ── Build team.json (language-independent) ───────────────────────────────────
// Key: slug from EN name. Deduplicate by avatar filename (invariant across locales).
// avatarFile → enSlug map for resolving refs in RU/FI locale services.

const teamMap = {}; // enSlug → person
const avatarToSlug = {}; // avatarFilename → enSlug

for (const service of raw.en.whatweoffer.services) {
	for (const tm of service.teammates) {
		const slug = slugify(tm.title);
		const filename = avatarFilename(tm.avatar?.url);

		// Register by avatar filename first (deduplicate same person different DatoCMS id)
		if (filename && avatarToSlug[filename]) continue;

		if (filename) avatarToSlug[filename] = slug;

		if (teamMap[slug]) continue; // already registered

		teamMap[slug] = {
			name: tm.title,
			avatar: filename ? `/assets/images/team/${filename}` : null,
			social: {
				url: tm.url || null,
				isActivated: tm.isactivatedurl === true,
			},
			recruit: tm.recruit ?? false,
			labelName: tm.labelName || "",
		};
	}
}

/**
 * Resolve teammate to EN slug via avatar URL.
 * Returns slug or null if not found (will be caught by schema validation).
 */
function resolveRef(tm) {
	const filename = avatarFilename(tm.avatar?.url);
	if (filename && avatarToSlug[filename]) return avatarToSlug[filename];
	// Fallback: try EN name slug (for edge cases)
	return slugify(tm.title);
}

write(join(root, "content/team.json"), teamMap);

// ── Per-locale content ────────────────────────────────────────────────────────

for (const locale of ["en", "ru", "fi"]) {
	const d = raw[locale];
	const dir = join(root, "content", locale);

	// site.json
	write(join(dir, "site.json"), {
		siteName: d._site.globalSeo.siteName,
		titleSuffix: d._site.globalSeo.titleSuffix?.trim() ?? "",
		facebookPageUrl: d._site.globalSeo.facebookPageUrl,
		seo: {
			title: d._site.globalSeo.fallbackSeo.title,
			description: d._site.globalSeo.fallbackSeo.description,
		},
	});

	// navigation.json
	write(join(dir, "navigation.json"), {
		links: d.navigation.headerlinks.map((l) => ({
			id: l.id,
			name: l.name,
			navanchor: l.navanchor,
		})),
	});

	// hero.json
	write(join(dir, "hero.json"), {
		label: d.heroSection.label,
		title: d.heroSection.title,
		description: d.heroSection.description,
		playButton: d.heroSection.playButton,
		mainVideoUrl: d.heroSection.mainVideoUrl,
		chat: d.heroSection.chat.map((c) => ({ id: c.id, message: c.message })),
	});

	// how-we-work.json
	write(join(dir, "how-we-work.json"), {
		title: d.howwework.title,
		steps: d.howwework.steps.map((s) => ({
			id: s.id,
			title: s.title,
			description: s.description.trim(),
		})),
	});

	// what-we-offer.json — only active services, sorted by order
	const activeServices = d.whatweoffer.services.filter((s) => s.active).sort((a, b) => a.order - b.order);

	write(join(dir, "what-we-offer.json"), {
		title: d.whatweoffer.title,
		services: activeServices.map((s) => ({
			id: s.id,
			slug: s.illustration, // illustration is locale-invariant — use as slug
			order: s.order,
			title: s.title,
			description: s.description,
			price: s.price,
			buttonName: s.buttonName,
			illustration: s.illustration,
			teammates: s.teammates.map((tm) => ({
				ref: resolveRef(tm),
				proff: tm.proff,
				description: tm.description,
			})),
		})),
	});

	// our-little-story.json
	write(join(dir, "our-little-story.json"), {
		title: d.ourlittlestory.title,
		description: d.ourlittlestory.description.trim(),
	});

	// get-in-touch.json
	write(join(dir, "get-in-touch.json"), {
		title: d.getintouch.title,
		description: d.getintouch.description,
		copyText: d.getintouch.copyText,
		tunnus: d.getintouch.tunnus,
		contacts: d.getintouch.contacts.map((c) => ({
			id: c.id,
			icon: c.icon,
			url: c.url,
		})),
	});
}

console.log("\nDone. content/ is ready.");
