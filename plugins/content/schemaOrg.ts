/**
 * plugins/content/schemaOrg.ts
 * JSON-LD structured data — LocalBusiness schema.
 * Port of timamih/helpers/transformToSchema.ts, adapted for new content structure.
 *
 * SECURITY: Output is passed through JSON.stringify + </script> protection.
 */

import type { PageContent } from "./schema.ts";

/** Protect against </script> injection in JSON-LD */
function safeJsonLd(obj: unknown): string {
	return JSON.stringify(obj).replace(/<\/script>/gi, "<\\/script>");
}

export function buildSchemaOrg(content: PageContent): string {
	const employees = content.team.map((person) => {
		// Find first proff/description for this person across services
		let jobTitle = "";
		let description = "";
		for (const service of content.resolvedServices) {
			const found = service.teammates.find((t) => t.slug === person.id);
			if (found) {
				jobTitle = found.proff;
				description = found.contextDescription;
				break;
			}
		}
		return {
			"@type": "Person",
			name: person.name,
			jobTitle,
			description,
			image: person.avatar ? `https://timamih.com${person.avatar}` : undefined,
		};
	});

	const schema = {
		"@context": "https://schema.org",
		"@type": "LocalBusiness",
		name: "TimaMih Tmi",
		url: "https://timamih.com",
		logo: "https://timamih.com/favicon.svg",
		slogan: content.hero.title.replaceAll(",", "").trim(),
		telephone: "+358453491091",
		sameAs: ["tg://resolve?domain=timamih_com", "https://wa.me/358453491091", "https://www.instagram.com/timamih_com/"],
		address: {
			"@type": "PostalAddress",
			streetAddress: "Hitsaajankatu 6",
			addressLocality: "Helsinki",
			addressRegion: "Uusimaa",
			postalCode: "00810",
			addressCountry: "Finland",
		},
		openingHours: ["Mo-Su 10:00-20:00"],
		currenciesAccepted: "EUR",
		paymentAccepted: "Cash, Credit Card",
		priceRange: "50€ - 1900€",
		aggregateRating: {
			"@type": "AggregateRating",
			bestRating: "5.0",
			ratingValue: "4.9",
			worstRating: "1.0",
			reviewCount: "7",
		},
		image: [
			"https://timamih.com/assets/images/og/og-1x1.webp",
			"https://timamih.com/assets/images/og/og-4x3.webp",
			"https://timamih.com/assets/images/og/og-16x9.webp",
		],
		employees,
	};

	return `<script type="application/ld+json">${safeJsonLd(schema)}</script>`;
}
