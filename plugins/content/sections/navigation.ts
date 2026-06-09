/**
 * sections/navigation.ts
 * Renders site header + mobile nav drawer.
 *
 * Islands used:
 *   - data-island="nav-drawer" (eager) — initNavDrawer
 *   - data-island="theme-toggle" (eager) — initThemeToggle (Шаг 3)
 */

import { attr, esc, icon } from "../html.ts";
import type { Locale, PageContent } from "../schema.ts";

/** URL for the home link per locale */
function homeUrl(locale: Locale): string {
	return locale === "en" ? "/" : `/${locale}/`;
}

/** URL for a given nav anchor per locale */
function navUrl(locale: Locale, navanchor: string): string {
	const base = homeUrl(locale);
	if (navanchor === "/") return base;
	return `${base}${navanchor}`;
}

export function renderNavigation(content: PageContent): string {
	const { locale, navigation } = content;

	const navLinks = navigation.links
		.map((link) => {
			const href = navUrl(locale, link.navanchor);
			// "Main" / home link has navanchor "/", others are section anchors
			const isHome = link.navanchor === "/";
			return `<li>
          <a class="nav-link" href="${attr(href)}"${isHome ? ` data-nav-home="true"` : ""}>${esc(link.name)}</a>
        </li>`;
		})
		.join("\n        ");

	// Drawer links include locale switcher
	const drawerLinks = navigation.links
		.map((link) => {
			const href = navUrl(locale, link.navanchor);
			return `<li>
            <a class="nav-drawer-link" href="${attr(href)}">${esc(link.name)}</a>
          </li>`;
		})
		.join("\n            ");

	// Language switcher — flat row of 3 links (EN RU FI)
	const langs: Array<{ code: Locale; label: string }> = [
		{ code: "en", label: "EN" },
		{ code: "ru", label: "RU" },
		{ code: "fi", label: "FI" },
	];

	const langHref = (code: Locale) => (code === "en" ? "/" : `/${code}/`);

	const langLinks = langs
		.map((l) => {
			const isCurrent = l.code === locale;
			return `<a class="lang-link${isCurrent ? " is-current" : ""}" href="${attr(langHref(l.code))}" lang="${l.code}"${isCurrent ? ` aria-current="page"` : ""}>${esc(l.label)}</a>`;
		})
		.join("\n        ");

	return `<header class="header" role="banner">
    <div class="header-inner">
      <!-- Logo -->
      <a class="header-logo" href="${attr(homeUrl(locale))}" aria-label="${esc(content.site.siteName)}">
        <span class="header-logo-text" aria-hidden="true"><strong>T</strong><strong>i</strong><strong>m</strong><strong>a</strong><b>M</b><b>i</b><b>h</b></span>
      </a>

      <!-- Desktop nav -->
      <nav class="header-nav" aria-label="Main navigation">
        <ul class="header-nav-list" role="list">
        ${navLinks}
        </ul>
      </nav>

      <!-- Actions: lang switcher + theme toggle + mobile menu -->
      <div class="header-actions">
        <!-- Language switcher (flat row, desktop) -->
        <div class="lang-switcher" aria-label="Language">
          ${langLinks}
        </div>

        <!-- Theme toggle — island mounts eager -->
        <button
          class="ibutton theme-toggle"
          data-island="theme-toggle"
          aria-label="Switch to dark theme"
          type="button"
        >
          ${icon("sun", "theme-icon theme-icon-light")}
          ${icon("moon", "theme-icon theme-icon-dark")}
        </button>

        <!-- Mobile menu trigger -->
        <button
          class="ibutton nav-drawer-trigger"
          aria-controls="nav-drawer"
          aria-expanded="false"
          aria-label="Open menu"
          type="button"
        >
          ${icon("menu")}
        </button>
      </div>
    </div>

    <!-- Mobile nav drawer -->
    <dialog class="nav-drawer" id="nav-drawer" aria-label="Navigation" data-island="nav-drawer">
      <div class="nav-drawer-header">
        <button class="ibutton nav-drawer-close" aria-label="Close menu" type="button">
          ${icon("close")}
        </button>
      </div>
      <nav class="nav-drawer-nav" aria-label="Mobile navigation">
        <ul class="nav-drawer-list" role="list">
          ${drawerLinks}
        </ul>
        <div class="nav-drawer-langs">
          ${langLinks}
        </div>
      </nav>
    </dialog>
  </header>`;
}
