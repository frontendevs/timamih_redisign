/**
 * sections/whatWeOffer.ts
 * "What We Offer" — faithful original: zig-zag list of services.
 *
 * Each service alternates illustration / content (CSS nth-child).
 * Content: title · description · price ("from N €").
 * Teammates are intentionally not rendered (disabled in the live original).
 */

import { attr, esc } from "../html.ts";
import type { Locale, PageContent } from "../schema.ts";

const PRICE_PREFIX: Record<Locale, string> = { en: "from", ru: "от", fi: "alkaen" };

export function renderWhatWeOffer(content: PageContent): string {
	const { whatWeOffer, locale } = content;
	const prefix = PRICE_PREFIX[locale];

	const services = whatWeOffer.services
		.map(
			(s) => `<div class="service a-reveal" itemscope itemtype="https://schema.org/Service">
        <div class="service-illustration">
          <img class="illustration illustration-light" src="/assets/images/services/${attr(s.illustration)}-light.svg" alt="" width="520" height="420" loading="lazy" decoding="async" />
          <img class="illustration illustration-dark" src="/assets/images/services/${attr(s.illustration)}-dark.svg" alt="" width="520" height="420" loading="lazy" decoding="async" />
        </div>
        <div class="service-content">
          <article class="service-article">
            <h3 class="service-title" itemprop="name">${esc(s.title)}</h3>
            <p class="service-desc" itemprop="description">${esc(s.description)}</p>
            <div class="service-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <sub>${esc(prefix)}</sub>
              <span itemprop="price">${esc(s.price)}</span>
            </div>
          </article>
        </div>
      </div>`,
		)
		.join("\n      ");

	return `<section class="section what-we-offer-section" id="what-we-offer" aria-labelledby="what-we-offer-title">
    <h2 class="section-title" id="what-we-offer-title">${esc(whatWeOffer.title)}</h2>
    <div class="services">
    ${services}
    </div>
  </section>`;
}
