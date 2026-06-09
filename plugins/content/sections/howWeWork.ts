/**
 * sections/howWeWork.ts
 * "How We Work" — faithful original: centered title, steps carousel + themed illustration.
 *
 * Island: data-island="steps-carousel" (lazy) — translateX track, dots, prev/next.
 * CSS fallback: steps stack vertically without JS.
 */

import { esc, icon } from "../html.ts";
import type { PageContent } from "../schema.ts";

export function renderHowWeWork(content: PageContent): string {
	const { howWeWork } = content;
	const total = howWeWork.steps.length;

	const slides = howWeWork.steps
		.map(
			(step, i) => `<li
            class="hww-slide${i === 0 ? " is-active" : ""}"
            role="group"
            aria-roledescription="slide"
            aria-label="${i + 1} / ${total}"
            data-js="carousel-slide"
          >
            <h3 class="hww-step-title">${esc(step.title)}</h3>
            <p class="hww-step-desc">${esc(step.description)}</p>
          </li>`,
		)
		.join("\n          ");

	const dots = howWeWork.steps
		.map(
			(step, i) => `<button
              class="hww-dot${i === 0 ? " is-active" : ""}"
              type="button"
              aria-label="${esc(step.title)}"
              data-js="carousel-dot"
              data-index="${i}"
            ></button>`,
		)
		.join("\n            ");

	return `<section class="section how-we-work-section how-we-work-grid" id="how-we-work" aria-labelledby="how-we-work-title">
    <h2 class="section-title how-we-work-title" id="how-we-work-title">${esc(howWeWork.title)}</h2>

    <div
      class="hww-content"
      data-island="steps-carousel"
      aria-roledescription="carousel"
      aria-label="${esc(howWeWork.title)}"
    >
      <output class="hww-numbers" aria-live="polite" aria-atomic="true" data-js="carousel-status">1 / ${total}</output>

      <div class="hww-viewport">
        <ul class="hww-track" role="list" data-js="carousel-track">
          ${slides}
        </ul>
      </div>

      <div class="hww-actions">
        <div class="hww-dots" role="group" aria-label="Go to step">
          ${dots}
        </div>
        <button class="hww-arrow is-disabled" type="button" aria-label="Previous step" data-js="carousel-prev">
          ${icon("arrow-left")}
        </button>
        <button class="hww-arrow" type="button" aria-label="Next step" data-js="carousel-next">
          ${icon("arrow-right")}
        </button>
      </div>
    </div>

    <div class="hww-illustration" aria-hidden="true">
      <img class="hww-illustration-img hww-illustration-light" src="/assets/images/steps-light.svg" alt="" width="480" height="480" decoding="async" />
      <img class="hww-illustration-img hww-illustration-dark" src="/assets/images/steps-dark.svg" alt="" width="480" height="480" decoding="async" />
    </div>
  </section>`;
}
