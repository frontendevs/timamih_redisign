/**
 * sections/getInTouch.ts
 * "Get In Touch" — faithful original: brand action buttons + copy rows + illustration.
 *
 * action-contacts: round brand-colored social buttons (working href, no JS).
 * copy-contacts: copy button (island) + formatted value with floating label.
 */

import { attr, esc, icon } from "../html.ts";
import type { Locale, PageContent } from "../schema.ts";

const COPY_LABELS: Record<Locale, Record<string, string>> = {
	en: { telephone: "Phone", telegram: "Telegram", whatsapp: "WhatsApp", email: "Email", instagram: "Instagram" },
	ru: { telephone: "Телефон", telegram: "Телеграм", whatsapp: "WhatsApp", email: "Эл. адрес", instagram: "Инстаграм" },
	fi: { telephone: "Puhelin", telegram: "Telegram", whatsapp: "WhatsApp", email: "Sähköposti", instagram: "Instagram" },
};

/** Build the working href per contact type (original urlSelect). */
function actionHref(iconName: string, url: string): string {
	switch (iconName) {
		case "telephone":
			return `tel:+${url}`;
		case "telegram":
			return `https://t.me/${url}`;
		case "whatsapp":
			return `https://wa.me/${url}`;
		case "email":
			return `mailto:${url}`;
		case "instagram":
			return `https://www.instagram.com/${url}/`;
		default:
			return url;
	}
}

/** Human-readable display value + copy value (original CopyContacts logic). */
function formatValue(iconName: string, url: string): { display: string; copy: string } {
	if (iconName === "telephone") {
		const phone = `+${url.slice(0, 3)} ${url.slice(3, 5)} ${url.slice(5, 8)} ${url.slice(8, 12)}`;
		return { display: phone, copy: `+${url}` };
	}
	if (iconName === "telegram") return { display: `@${url}`, copy: `@${url}` };
	return { display: url, copy: url };
}

export function renderGetInTouch(content: PageContent): string {
	const { getInTouch, locale } = content;
	const labels = COPY_LABELS[locale];

	const actionButtons = getInTouch.contacts
		.filter((c) => c.url)
		.map((c) => {
			const href = actionHref(c.icon, c.url);
			const iconId = c.icon === "phone" ? "telephone" : c.icon;
			return `<a class="contact-button contact-${attr(c.icon)}" href="${attr(href)}" aria-label="${esc(c.icon)}"${href.startsWith("http") ? ` target="_blank" rel="noopener noreferrer"` : ""}>
            ${icon(iconId, "contact-icon")}
          </a>`;
		})
		.join("\n          ");

	const copyRows = getInTouch.contacts
		.filter((c) => c.url)
		.map((c) => {
			const { display, copy } = formatValue(c.icon, c.url);
			const label = labels[c.icon] ?? c.icon;
			return `<div class="copy-contact">
            <button
              class="ibutton small-button copy-contact-btn"
              type="button"
              data-island="copy-contact"
              data-copy-value="${attr(copy)}"
              aria-label="${esc(getInTouch.copyText)}: ${esc(display)}"
            >
              ${icon("copy")}
            </button>
            <p class="copy-data" data-label="${attr(label)}">${esc(display)}</p>
          </div>`;
		})
		.join("\n          ");

	return `<section class="section get-in-touch-section get-in-touch-grid" id="get-in-touch" aria-labelledby="get-in-touch-title">
    <header class="get-in-touch-header">
      <h2 class="section-title" id="get-in-touch-title">${esc(getInTouch.title)}</h2>
      <p class="get-in-touch-desc">${esc(getInTouch.description)}</p>
    </header>

    <div class="contacts">
      <div class="action-contacts">
        ${actionButtons}
      </div>

      <h3 class="copy-title">${esc(getInTouch.copyText)}</h3>

      <div class="copy-contacts">
        ${copyRows}
      </div>
    </div>

    <div class="get-in-touch-illustration" aria-hidden="true">
      <img class="illustration illustration-light" src="/assets/images/contact-light.svg" alt="" width="520" height="420" loading="lazy" decoding="async" />
      <img class="illustration illustration-dark" src="/assets/images/contact-dark.svg" alt="" width="520" height="420" loading="lazy" decoding="async" />
    </div>
  </section>`;
}
