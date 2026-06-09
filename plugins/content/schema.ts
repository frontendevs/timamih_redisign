/**
 * plugins/content/schema.ts
 * TypeScript types for structured content + loadContent(locale).
 * validate() throws on missing files, missing keys, or broken teammate refs.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ── Primitive types ──────────────────────────────────────────────────────────

export type Locale = "en" | "ru" | "fi";

export interface TeamPerson {
	name: string;
	avatar: string | null;
	social: {
		url: string | null;
		isActivated: boolean;
	};
	recruit: boolean;
	labelName: string;
}

export type TeamRegistry = Record<string, TeamPerson>;

// ── Navigation ────────────────────────────────────────────────────────────────

export interface NavLink {
	id: string;
	name: string;
	navanchor: string;
}

export interface NavigationContent {
	links: NavLink[];
}

// ── Site ─────────────────────────────────────────────────────────────────────

export interface SiteContent {
	siteName: string;
	titleSuffix: string;
	facebookPageUrl: string;
	seo: {
		title: string;
		description: string;
	};
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
	id: string;
	message: string;
}

export interface HeroContent {
	label: string;
	title: string;
	description: string;
	playButton: string;
	mainVideoUrl: string;
	chat: ChatMessage[];
}

// ── How We Work ───────────────────────────────────────────────────────────────

export interface WorkStep {
	id: string;
	title: string;
	description: string;
}

export interface HowWeWorkContent {
	title: string;
	steps: WorkStep[];
}

// ── What We Offer ─────────────────────────────────────────────────────────────

export interface TeammateRef {
	ref: string; // slug key in TeamRegistry
	proff: string;
	description: string;
}

export interface Service {
	id: string;
	slug: string;
	order: number;
	title: string;
	description: string;
	price: string;
	buttonName: string;
	illustration: string;
	teammates: TeammateRef[];
}

export interface WhatWeOfferContent {
	title: string;
	services: Service[];
}

// ── Our Little Story ──────────────────────────────────────────────────────────

export interface OurLittleStoryContent {
	title: string;
	description: string;
}

// ── Get In Touch ──────────────────────────────────────────────────────────────

export type ContactIcon = "telephone" | "telegram" | "whatsapp" | "instagram" | "email" | "phone";

export interface Contact {
	id: string;
	icon: ContactIcon;
	url: string;
}

export interface GetInTouchContent {
	title: string;
	description: string;
	copyText: string;
	tunnus: string;
	contacts: Contact[];
}

// ── Resolved teammate (ref resolved to person) ────────────────────────────────

export interface ResolvedTeammate extends TeamPerson {
	slug: string;
	proff: string;
	contextDescription: string;
}

export interface ResolvedService extends Omit<Service, "teammates"> {
	teammates: ResolvedTeammate[];
}

// ── Full page content ─────────────────────────────────────────────────────────

export interface PageContent {
	locale: Locale;
	team: TeamRegistry;
	site: SiteContent;
	navigation: NavigationContent;
	hero: HeroContent;
	howWeWork: HowWeWorkContent;
	whatWeOffer: WhatWeOfferContent;
	resolvedServices: ResolvedService[];
	ourLittleStory: OurLittleStoryContent;
	getInTouch: GetInTouchContent;
}

// ── Loader ────────────────────────────────────────────────────────────────────

const CONTENT_ROOT = join(import.meta.dirname, "../../content");

function readJson<T>(path: string): T {
	if (!existsSync(path)) {
		throw new Error(`[content] Missing file: ${path}`);
	}
	const raw = readFileSync(path, "utf-8");
	return JSON.parse(raw) as T;
}

function validateKeys(a: Record<string, unknown>, b: Record<string, unknown>, label: string): void {
	const keysA = Object.keys(a).sort();
	const keysB = Object.keys(b).sort();
	const missingInB = keysA.filter((k) => !keysB.includes(k));
	const extraInB = keysB.filter((k) => !keysA.includes(k));
	if (missingInB.length > 0 || extraInB.length > 0) {
		throw new Error(
			`[content] Key mismatch in ${label}. Missing: [${missingInB.join(", ")}]. Extra: [${extraInB.join(", ")}].`,
		);
	}
}

export function loadContent(locale: Locale): PageContent {
	const localeDir = join(CONTENT_ROOT, locale);
	const enDir = join(CONTENT_ROOT, "en");

	const team = readJson<TeamRegistry>(join(CONTENT_ROOT, "team.json"));
	const site = readJson<SiteContent>(join(localeDir, "site.json"));
	const navigation = readJson<NavigationContent>(join(localeDir, "navigation.json"));
	const hero = readJson<HeroContent>(join(localeDir, "hero.json"));
	const howWeWork = readJson<HowWeWorkContent>(join(localeDir, "how-we-work.json"));
	const whatWeOffer = readJson<WhatWeOfferContent>(join(localeDir, "what-we-offer.json"));
	const ourLittleStory = readJson<OurLittleStoryContent>(join(localeDir, "our-little-story.json"));
	const getInTouch = readJson<GetInTouchContent>(join(localeDir, "get-in-touch.json"));

	// Cross-locale key validation against EN as source of truth
	if (locale !== "en") {
		const enSite = readJson<SiteContent>(join(enDir, "site.json"));
		const enNav = readJson<NavigationContent>(join(enDir, "navigation.json"));
		const enOffer = readJson<WhatWeOfferContent>(join(enDir, "what-we-offer.json"));

		validateKeys(
			enSite as unknown as Record<string, unknown>,
			site as unknown as Record<string, unknown>,
			`${locale}/site.json`,
		);
		validateKeys(
			enNav as unknown as Record<string, unknown>,
			navigation as unknown as Record<string, unknown>,
			`${locale}/navigation.json`,
		);
		// Warn on service count mismatch (locales may intentionally differ in active services)
		if (enOffer.services.length !== whatWeOffer.services.length) {
			console.warn(
				`[content] WARNING: Service count differs in ${locale}/what-we-offer.json: en=${enOffer.services.length}, ${locale}=${whatWeOffer.services.length}`,
			);
		}
	}

	// Resolve teammate refs
	const resolvedServices: ResolvedService[] = whatWeOffer.services.map((service) => ({
		...service,
		teammates: service.teammates.map((tm) => {
			const person = team[tm.ref];
			if (!person) {
				throw new Error(
					`[content] Broken teammate ref "${tm.ref}" in ${locale}/what-we-offer.json (service: "${service.title}")`,
				);
			}
			return {
				slug: tm.ref,
				...person,
				proff: tm.proff,
				contextDescription: tm.description,
			};
		}),
	}));

	return {
		locale,
		team,
		site,
		navigation,
		hero,
		howWeWork,
		whatWeOffer,
		ourLittleStory,
		getInTouch,
		resolvedServices,
	};
}
