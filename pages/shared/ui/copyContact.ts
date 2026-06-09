/* Copy-contact island — copies data-copy-value to clipboard and shows toast.
 * Root: [data-island="copy-contact"] (each copy button is its own island).
 * Falls back silently (no crash) when Clipboard API is unavailable.
 *
 * Usage in HTML:
 *   <button data-island="copy-contact" data-copy-value="+35845...">…</button>
 */
import { showToast } from "./toast.ts";

const COPY_SUCCESS_LABELS: Record<string, string> = {
	en: "Copied!",
	ru: "Скопировано!",
	fi: "Kopioitu!",
};

function getLabel(): string {
	const lang = document.documentElement.lang ?? "en";
	return COPY_SUCCESS_LABELS[lang] ?? "Copied!";
}

export function initCopyContact(root: HTMLElement): () => void {
	const value = root.dataset.copyValue ?? "";
	if (!value) return () => {};

	const ac = new AbortController();

	root.addEventListener(
		"click",
		async () => {
			if (!navigator.clipboard) return;
			try {
				await navigator.clipboard.writeText(value);
				showToast(getLabel(), "success");
			} catch {
				// User denied or API error — silent (href tel:/mailto: still works)
			}
		},
		{ signal: ac.signal },
	);

	return () => ac.abort();
}
