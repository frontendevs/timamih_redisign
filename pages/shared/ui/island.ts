/* Element-bound island runtime — mounts EVERY [data-island="name"] (repeatable
 * islands like cards, single ones like nav-drawer alike). Returns one cleanup
 * that tears down all instances.
 *
 * Sync factory by design (predictable, cleanup-captured). For heavy code-split
 * islands add a separate registerLazyIsland() with dynamic import later — don't
 * make dynamic import the base contract.
 *
 * Returns a cleanup; it does NOT touch pagehide/pageshow. The page-level
 * bootstrap() is the single lifecycle owner — pass this return into its array:
 *   bootstrap(() => [ registerIsland("nav-drawer", initNavDrawer, { eager: true }) ]);
 *
 *   eager      — mount immediately (no IntersectionObserver). Default: lazy.
 *   rootMargin — lazy preload margin. Default "200px".
 */
type IslandFactory = (el: HTMLElement) => () => void;

interface IslandOptions {
	eager?: boolean;
	rootMargin?: string;
}

export function registerIsland(name: string, factory: IslandFactory, options: IslandOptions = {}): () => void {
	const els = document.querySelectorAll<HTMLElement>(`[data-island="${name}"]`);
	if (els.length === 0) return () => {};

	const cleanups = Array.from(els, (el) => mountIsland(el, factory, options));
	return () => {
		for (const cleanup of cleanups) cleanup();
	};
}

function mountIsland(el: HTMLElement, factory: IslandFactory, options: IslandOptions): () => void {
	if (options.eager) return factory(el);

	// Lazy: mount near the viewport. Capture the factory's cleanup so teardown
	// (or teardown before the element ever intersects) is honored.
	let cleanup = (): void => {};
	let aborted = false;

	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries[0]?.isIntersecting) return;
			observer.disconnect();
			cleanup = factory(el);
			if (aborted) cleanup();
		},
		{ rootMargin: options.rootMargin ?? "200px" },
	);
	observer.observe(el);

	return () => {
		aborted = true;
		observer.disconnect();
		cleanup();
	};
}
