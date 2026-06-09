// Island: scroll reveal — fades in elements as they enter the viewport.
// Pair: assets/css/utils/reveal.css. The CSS hides .a-reveal ONLY under
// body[data-reveal-ready], which this island sets — so JS-off / failed chunk /
// reduced-motion leaves content visible. Opt-in recipe — ship both or neither.
export function scrollReveal(): () => void {
	const els = document.querySelectorAll<HTMLElement>(".a-reveal");
	if (els.length === 0) return () => {};

	// Reduced motion: leave content visible — never arm the CSS hide.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

	// JS is live and motion is allowed → let the CSS hide .a-reveal, then reveal on scroll.
	document.body.dataset.revealReady = "";

	// rootMargin shrinks the viewport bottom by 80px so elements reveal slightly
	// before reaching the very edge.
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-visible");
					observer.unobserve(entry.target); // reveal runs once
				}
			}
		},
		{ threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
	);

	for (const el of els) observer.observe(el);

	return () => {
		observer.disconnect();
		delete document.body.dataset.revealReady;
	};
}
