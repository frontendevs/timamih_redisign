/**
 * plugins/content/html.ts
 * Minimal HTML escaping utilities for prebuild template literals.
 *
 * SECURITY: Template literals in prebuild do NOT auto-escape.
 * Use esc() on ALL interpolated user/CMS content.
 * Use attr() for HTML attribute values.
 */

const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
};

/** Escape HTML special chars. Use on ALL text content from CMS/JSON. */
export function esc(value: unknown): string {
	if (value === null || value === undefined) return "";
	return String(value).replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] ?? ch);
}

/** Escape for use inside an HTML attribute value (double-quoted). */
export function attr(value: unknown): string {
	return esc(value);
}

/**
 * Render a safe SVG icon reference (same-document sprite).
 * @param id   Symbol id without "icon-" prefix — the function adds it.
 * @param cls  Additional CSS classes on the <svg> element.
 */
export function icon(id: string, cls = ""): string {
	const classes = ["icon", cls].filter(Boolean).join(" ");
	return `<svg class="${attr(classes)}" aria-hidden="true" focusable="false"><use href="#icon-${attr(id)}"></use></svg>`;
}

/**
 * Build a contact href from icon type + raw url value.
 * telephone → tel:+<digits>
 * telegram  → https://t.me/<username>
 * whatsapp  → https://wa.me/<digits>
 * instagram → https://www.instagram.com/<username>/
 * email     → mailto:<address>
 * (fallback) url with @ → mailto:, url with http → as-is
 */
export function buildContactHref(iconType: string, url: string): string {
	if (!url) return "#";
	switch (iconType) {
		case "telephone":
		case "phone":
			return `tel:+${url.replace(/^\+/, "")}`;
		case "telegram":
			return `https://t.me/${url}`;
		case "whatsapp":
			return `https://wa.me/${url.replace(/^\+/, "")}`;
		case "instagram":
			return `https://www.instagram.com/${url}/`;
		case "email":
			return `mailto:${url}`;
		default:
			if (url.includes("@")) return `mailto:${url}`;
			if (url.startsWith("http")) return url;
			return `#`;
	}
}

/**
 * Build the social link href for a teammate social.url.
 * If url contains '@' → mailto:, if http → as-is.
 */
export function buildSocialHref(url: string | null): string {
	if (!url) return "#";
	if (url.includes("@")) return `mailto:${url}`;
	if (url.startsWith("http")) return url;
	return "#";
}
