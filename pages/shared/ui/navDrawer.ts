/* Island: nav-drawer — drives the native <dialog class="nav-drawer"> (see nav-drawer.css).
 * Mount: registerIsland("nav-drawer", initNavDrawer, { eager: true }).
 *
 * Markup:
 *   <button aria-controls="nav-drawer" aria-expanded="false">Menu</button>
 *   <dialog class="nav-drawer" id="nav-drawer" aria-label="Navigation"> … </dialog>
 *
 * Contract: trigger toggles aria-expanded; open via showModal(); close on link /
 * backdrop / Escape (native close event); focus returns to the trigger; when the
 * layout hides the trigger (desktop), an open drawer closes — so the page never
 * stays inert/scroll-locked. All listeners under one AbortController.
 */
export function initNavDrawer(el: HTMLElement): () => void {
	const dialog = el as HTMLDialogElement;
	const trigger = document.querySelector<HTMLElement>(`[aria-controls="${dialog.id}"]`);

	const controller = new AbortController();
	const { signal } = controller;

	const close = (): void => {
		if (dialog.open) dialog.close();
	};

	trigger?.addEventListener(
		"click",
		() => {
			dialog.showModal();
			trigger.setAttribute("aria-expanded", "true");
		},
		{ signal },
	);

	// Native close (Escape, dialog.close(), form method=dialog) → sync state + return focus
	dialog.addEventListener(
		"close",
		() => {
			trigger?.setAttribute("aria-expanded", "false");
			trigger?.focus();
		},
		{ signal },
	);

	dialog.addEventListener(
		"click",
		(e) => {
			const target = e.target as Element;
			// Backdrop click lands on the dialog element itself; close button or link closes.
			if (target === dialog || target.closest(".nav-drawer-close") || target.closest("a")) close();
		},
		{ signal },
	);

	// Trigger hidden by the layout (e.g. desktop) while open → close, so the page
	// can't stay inert/scroll-locked. offsetParent === null = display:none, no
	// hardcoded breakpoint to drift from the CSS container query.
	window.addEventListener(
		"resize",
		() => {
			if (dialog.open && trigger && trigger.offsetParent === null) close();
		},
		{ signal },
	);

	return () => controller.abort();
}
