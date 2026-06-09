/**
 * sections/footer.ts
 * Footer — faithful original: centered, 3 lines (name © year · tunnus · credit).
 * Island: footerYear() fills [data-js-target="footer-year"].
 */

import { esc } from "../html.ts";
import type { PageContent } from "../schema.ts";

export function renderFooter(content: PageContent): string {
	const { site, getInTouch } = content;

	return `<footer class="footer" role="contentinfo">
    <p class="footer-name">${esc(site.siteName)} Tmi © <span data-js-target="footer-year">2025</span></p>
    <p class="footer-tunnus">${esc(getInTouch.tunnus)}</p>
    <p class="footer-credit">Designed by <a href="https://www.devan.fi" target="_blank" rel="noopener noreferrer">devan.fi</a></p>
  </footer>`;
}
