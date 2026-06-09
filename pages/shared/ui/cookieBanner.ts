const DEFAULT_COOKIE_NAME = "cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface CookieBannerOptions {
	cookieName?: string;
	maxAge?: number;
	onAccept?: () => void;
}

function hasCookie(name: string): boolean {
	return document.cookie.split(";").some((entry) => entry.trim().startsWith(`${name}=`));
}

function setCookie(name: string, maxAge: number): void {
	const secure = location.protocol === "https:" ? "; Secure" : "";
	// eslint-disable-next-line unicorn/no-document-cookie -- consent cookie is client-side state, not auth/session.
	document.cookie = `${name}=1; max-age=${maxAge}; path=/; SameSite=Lax${secure}`;
}

/* Cookie consent banner behavior.
 *
 * Markup:
 *   <aside data-js="cookie-banner" hidden>
 *     <button data-js-action="accept">Accept</button>
 *   </aside>
 *
 * Analytics stays outside: pass onAccept when a project needs to load trackers.
 */
export function cookieBanner(options: CookieBannerOptions = {}): () => void {
	const banner = document.querySelector<HTMLElement>('[data-js="cookie-banner"]');
	if (!banner) return () => {};

	const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
	const maxAge = options.maxAge ?? ONE_YEAR_SECONDS;

	if (hasCookie(cookieName)) {
		options.onAccept?.();
		return () => {};
	}

	banner.hidden = false;

	const controller = new AbortController();

	const onClick = (e: Event): void => {
		const button = (e.target as Element | null)?.closest<HTMLElement>('[data-js-action="accept"]');
		if (!button || !banner.contains(button)) return;
		setCookie(cookieName, maxAge);
		options.onAccept?.();
		banner.remove();
		controller.abort();
	};

	banner.addEventListener("click", onClick, { signal: controller.signal });
	return () => controller.abort();
}
