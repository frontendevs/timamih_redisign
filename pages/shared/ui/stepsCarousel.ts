/* Steps carousel — prev/next/dots navigation.
 * Root: [data-island="steps-carousel"]
 * Internals (data-js): carousel-track, carousel-slide, carousel-dot,
 *                      carousel-prev, carousel-next, carousel-status
 *
 * CSS owns the transform; this only drives the index + class state.
 * Keyboard: ArrowLeft/ArrowRight on the track; Enter/Space on dots.
 * No-JS fallback: all slides visible vertically (CSS .hww-content:not([data-island])).
 */
export function initStepsCarousel(root: HTMLElement): () => void {
	const track = root.querySelector<HTMLElement>('[data-js="carousel-track"]');
	const slides = root.querySelectorAll<HTMLElement>('[data-js="carousel-slide"]');
	const dots = root.querySelectorAll<HTMLButtonElement>('[data-js="carousel-dot"]');
	const prev = root.querySelector<HTMLButtonElement>('[data-js="carousel-prev"]');
	const next = root.querySelector<HTMLButtonElement>('[data-js="carousel-next"]');
	const status = root.querySelector<HTMLOutputElement>('[data-js="carousel-status"]');

	if (!track || slides.length === 0) return () => {};

	const total = slides.length;
	let current = 0;

	// `track` is confirmed non-null above; capture for use in closures
	const trackEl = track;

	function goTo(index: number): void {
		const clamped = Math.max(0, Math.min(index, total - 1));
		if (clamped === current && index === clamped) return;
		current = clamped;
		sync();
	}

	function sync(): void {
		// Slide transform
		trackEl.style.transform = `translateX(-${current * 100}%)`;

		// Slide active class + aria-hidden
		slides.forEach((slide, i) => {
			slide.classList.toggle("is-active", i === current);
			slide.setAttribute("aria-hidden", String(i !== current));
		});

		// Dot active class
		dots.forEach((dot, i) => {
			dot.classList.toggle("is-active", i === current);
			dot.setAttribute("aria-pressed", String(i === current));
		});

		// Prev/next disabled state
		prev?.classList.toggle("is-disabled", current === 0);
		next?.classList.toggle("is-disabled", current === total - 1);

		// Accessible status
		if (status) status.textContent = `${current + 1} / ${total}`;
	}

	const ac = new AbortController();
	const { signal } = ac;

	prev?.addEventListener("click", () => goTo(current - 1), { signal });
	next?.addEventListener("click", () => goTo(current + 1), { signal });

	dots.forEach((dot, i) => {
		dot.addEventListener("click", () => goTo(i), { signal });
	});

	// Arrow key navigation when focus is inside the root
	root.addEventListener(
		"keydown",
		(e) => {
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				goTo(current - 1);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				goTo(current + 1);
			}
		},
		{ signal },
	);

	// Initial sync (first slide is already active from prebuild, but sync state)
	sync();

	return () => ac.abort();
}
