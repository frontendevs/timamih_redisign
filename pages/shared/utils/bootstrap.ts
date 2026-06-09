/* Page lifecycle — the SINGLE owner of pagehide/pageshow.
 * init() returns the page's cleanups (global behaviors + registerIsland() returns).
 * On bfcache restore (pageshow.persisted) it tears down and re-inits.
 *
 *   bootstrap(() => [
 *     footerYear(),
 *     toast(),
 *     scrollReveal(),
 *     registerIsland("nav-drawer", initNavDrawer, { eager: true }),
 *   ]);
 */
export function bootstrap(init: () => Array<() => void>): void {
	let cleanups: Array<() => void> = [];

	const run = (): void => {
		cleanups = init();
	};

	run();

	window.addEventListener("pagehide", () => {
		for (const cleanup of cleanups) cleanup();
		cleanups = [];
	});

	window.addEventListener("pageshow", (e: PageTransitionEvent) => {
		if (e.persisted) run();
	});
}
