/* Island: video-modal — drives the native <dialog class="video-modal">.
 * Mount: registerIsland("video-modal", initVideoModal, { eager: true }).
 *
 * Markup:
 *   <button aria-controls="video-modal" aria-expanded="false" aria-haspopup="dialog">…</button>
 *   <dialog class="video-modal" id="video-modal" data-island="video-modal" data-video-src="…">
 *     <div class="video-modal-inner">
 *       <button class="ibutton video-modal-close" aria-label="Close video">…</button>
 *       <div class="video-modal-frame" data-js="video-modal-frame"></div>
 *     </div>
 *   </dialog>
 *
 * iframe is inserted on open and removed on close so the video stops playing.
 */
export function initVideoModal(el: HTMLElement): () => void {
	const dialog = el as HTMLDialogElement;
	const trigger = document.querySelector<HTMLElement>(`[aria-controls="${dialog.id}"]`);
	const frame = dialog.querySelector<HTMLElement>('[data-js="video-modal-frame"]');
	const src = dialog.dataset.videoSrc ?? "";

	const ac = new AbortController();
	const { signal } = ac;

	const open = (): void => {
		if (!frame || !src) return;
		const iframe = document.createElement("iframe");
		iframe.src = src;
		iframe.title = "Video player";
		iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
		iframe.allowFullscreen = true;
		frame.replaceChildren(iframe);
		dialog.showModal();
		trigger?.setAttribute("aria-expanded", "true");
	};

	const close = (): void => {
		frame?.replaceChildren(); // removes iframe → stops playback
		if (dialog.open) dialog.close();
	};

	trigger?.addEventListener("click", open, { signal });

	dialog.addEventListener(
		"close",
		() => {
			frame?.replaceChildren();
			trigger?.setAttribute("aria-expanded", "false");
			trigger?.focus();
		},
		{ signal },
	);

	dialog.addEventListener(
		"click",
		(e) => {
			const target = e.target as Element;
			if (target === dialog || target.closest(".video-modal-close")) close();
		},
		{ signal },
	);

	return () => ac.abort();
}
