/**
 * plugins/content/render.ts
 * renderPage(content, locale) → full <!doctype html> string.
 */

import { renderHead } from "./head.ts";
import { attr, esc, icon } from "./html.ts";
import type { PageContent } from "./schema.ts";
import { renderFooter } from "./sections/footer.ts";
import { renderGetInTouch } from "./sections/getInTouch.ts";
import { renderHero } from "./sections/hero.ts";
import { renderHowWeWork } from "./sections/howWeWork.ts";
import { renderNavigation } from "./sections/navigation.ts";
import { renderOurLittleStory } from "./sections/ourLittleStory.ts";
import { renderWhatWeOffer } from "./sections/whatWeOffer.ts";
import { buildSprite } from "./sprite.ts";

const LOCALE_LANG: Record<string, string> = { en: "en", ru: "ru", fi: "fi" };

const CLOSE_VIDEO_LABEL: Record<string, string> = {
	en: "Close video",
	ru: "Закрыть видео",
	fi: "Sulje video",
};

export function renderPage(content: PageContent): string {
	const lang = LOCALE_LANG[content.locale] ?? "en";
	const head = renderHead(content);
	const sprite = buildSprite();
	const nav = renderNavigation(content);
	const hero = renderHero(content);
	const howWeWork = renderHowWeWork(content);
	const whatWeOffer = renderWhatWeOffer(content);
	const ourStory = renderOurLittleStory(content);
	const getInTouch = renderGetInTouch(content);
	const footer = renderFooter(content);

	return `<!doctype html>
<html lang="${lang}" data-theme="light">
  ${head}
  <body>
    <!-- SVG sprite — first node, same-document href="#icon-*" references -->
    ${sprite}

    <!-- Toast container — managed by toast() island -->
    <div id="toast-root" aria-live="polite" aria-atomic="true"></div>

    ${nav}

    <main class="main" id="main-content">
      ${hero}
      ${howWeWork}
      ${whatWeOffer}
      ${ourStory}
      ${getInTouch}
    </main>

    ${footer}

    <!-- Video modal — eager island, iframe inserted on open / removed on close -->
    <dialog class="video-modal" id="video-modal" data-island="video-modal" data-video-src="${attr(content.hero.mainVideoUrl)}">
      <div class="video-modal-inner">
        <button class="ibutton video-modal-close" type="button" aria-label="${esc(CLOSE_VIDEO_LABEL[content.locale] ?? "Close video")}">
          ${icon("close")}
        </button>
        <div class="video-modal-frame" data-js="video-modal-frame"></div>
      </div>
    </dialog>

    <!-- Page scripts -->
    <script type="module" src="/index/scripts/index.ts"></script>
  </body>
</html>`;
}
