/**
 * sections/ourLittleStory.ts
 * Renders the "Our Little Story" / About us section.
 *
 * description field: multi-paragraph with \n\n → split into <p> elements.
 */

import { esc } from "../html.ts";
import type { PageContent } from "../schema.ts";

export function renderOurLittleStory(content: PageContent): string {
	const { ourLittleStory } = content;

	// Split on double newline (trim whitespace around each paragraph)
	const paragraphs = ourLittleStory.description
		.split(/\n\n+/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => `<p class="story-paragraph">${esc(p)}</p>`)
		.join("\n        ");

	return `<section class="section our-story-section a-reveal" id="who-we-are" aria-labelledby="our-story-title">
    <div class="our-story-content">
      <h2 class="section-title our-story-title" id="our-story-title">${esc(ourLittleStory.title)}</h2>
      <div class="our-story-body">
        ${paragraphs}
      </div>
    </div>
  </section>`;
}
