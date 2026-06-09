/**
 * sections/hero.ts
 * Hero — faithful reproduction of the original timamih design.
 *
 * Left: label (+ star), title (first word accented) with brush underline, description.
 * Right: avatar photo in an SVG silhouette mask with elliptical ground shadow,
 *        chat messages (time + read-tick + smile), scattered 4-point stars.
 * Island: video-modal (lazy) via play button.
 */

import { esc } from "../html.ts";
import type { PageContent } from "../schema.ts";

/** Original star — 4-point, viewBox 65×65. tone: accent | secondary. */
function star(cls: string, tone: "accent" | "secondary", size: number): string {
	return `<svg class="hero-star ${cls} hero-star-${tone}" width="${size}" height="${size}" viewBox="0 0 65 65" fill="none" aria-hidden="true"><path d="M32,0l4.7,27c0,0.2,0.2,0.3,0.3,0.3L64,32l-27,4.7c-0.2,0-0.3,0.2-0.3,0.3L32,64l-4.7-27c0-0.2-0.2-0.3-0.3-0.3L0,32l27-4.7c0.2,0,0.3-0.2,0.3-0.3L32,0z"/></svg>`;
}

/** Title split: first word of first segment is accented; segments stack as lines. */
function renderTitle(title: string): string {
	return title
		.split(",")
		.map((seg, i) => {
			const part = seg.trim();
			if (i === 0) {
				const [first, ...rest] = part.split(" ");
				return `<span><strong>${esc(first ?? "")}</strong> ${esc(rest.join(" "))}</span>`;
			}
			return `<span>${esc(part)}</span>`;
		})
		.join("\n          ");
}

export function renderHero(content: PageContent): string {
	const { hero } = content;

	const messages = hero.chat
		.map(
			(msg, i) => `<div class="hero-msg">
            <p>${esc(msg.message)}</p>
            ${i === 0 ? `<span class="hero-msg-smile"></span>` : ""}
            <time>14:53</time>
            <svg class="hero-msg-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M0.41,13.41L6,19L7.41,17.58L1.83,12M22.24,5.58L11.66,16.17L7.5,12L6.07,13.41L11.66,19L23.66,7M18,7L16.59,5.58L10.24,11.93L11.66,13.34L18,7Z"/></svg>
          </div>`,
		)
		.join("\n          ");

	return `<section class="section hero" id="home" aria-labelledby="hero-title">
    <div class="hero-left">
      <p class="hero-label">
        ${esc(hero.label)}
        ${star("hero-label-star", "accent", 36)}
      </p>

      <h1 class="hero-title" id="hero-title">
        ${renderTitle(hero.title)}
        <svg class="hero-underline" viewBox="0 0 358 23" fill="none" aria-hidden="true"><path d="M2.58433 17.2277C111.649 0.38611 240.277 -7.98615 349.982 10.3551C356.464 11.4388 359.261 15.0846 357.467 18.433C355.673 21.7815 353.448 24.0515 343.473 22.5036C261.944 6.70847 173.961 7.05371 89.324 12.7935C60.7553 14.7741 32.3866 17.6553 4.33961 21.4247C2.98768 21.565 0.80493 21.2963 0.165868 19.8407C-0.518641 18.2816 1.03868 17.4664 2.58433 17.2277Z"/></svg>
      </h1>

      <p class="hero-desc">${esc(hero.description)}</p>

      <div class="hero-actions">
        <button
          class="button button-secondary hero-play"
          type="button"
          aria-controls="video-modal"
          aria-expanded="false"
          aria-haspopup="dialog"
          data-js="video-modal-trigger"
        >
          ${icon("play")}
          ${esc(hero.playButton)}
        </button>
      </div>
    </div>

    <div class="hero-right">
      <div class="hero-avatar">
        <svg class="hero-avatar-svg" viewBox="0 0 645 755" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="hero-ellipse-grad" x1="185" y1="600" x2="185" y2="700" gradientUnits="userSpaceOnUse">
              <stop offset=".1" class="hero-ellipse-stop hero-ellipse-stop-start" />
              <stop offset="1" class="hero-ellipse-stop hero-ellipse-stop-end" />
            </linearGradient>
            <mask id="hero-avatar-mask">
              <path d="M644.896 702.519C644.896 731.227 500.746 754.5 322.927 754.5C145.108 754.5 0.957031 731.227 0.957031 702.519C0.957031 194.515 129.369 0.5 307.188 0.5C485.007 0.5 644.896 141.057 644.896 702.519Z" fill="#fff"/>
            </mask>
          </defs>
          <ellipse cx="322.239" cy="702" rx="321.97" ry="51.98" fill="url(#hero-ellipse-grad)"/>
          <image class="hero-avatar-img hero-avatar-img-light" mask="url(#hero-avatar-mask)" width="550" height="800" x="45" href="/assets/images/hero/tima-light.webp"/>
          <image class="hero-avatar-img hero-avatar-img-dark" mask="url(#hero-avatar-mask)" width="550" height="800" x="45" href="/assets/images/hero/tima-dark.webp"/>
        </svg>
      </div>

      <div class="hero-messages" aria-hidden="true">
        ${messages}
      </div>

      ${star("hero-star-1", "accent", 32)}
      ${star("hero-star-2", "secondary", 24)}
      ${star("hero-star-3", "accent", 24)}
    </div>
  </section>`;
}
