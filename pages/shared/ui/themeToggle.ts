/* theme-toggle island — toggles light ↔ dark.
 * Default (no localStorage): light.
 *
 * Mirrors the inline anti-flash script in <head>:
 *   localStorage "theme" = "light" | "dark" → [data-theme] on <html>
 *   no stored value → "light" (default)
 *
 * Icon visibility is pure CSS (.theme-icon-* keyed on [data-theme]).
 * Returns cleanup (AbortController).
 */

type ThemeMode = "light" | "dark";

function currentMode(): ThemeMode {
	const stored = localStorage.getItem("theme");
	return stored === "dark" ? "dark" : "light";
}

function applyMode(mode: ThemeMode): void {
	localStorage.setItem("theme", mode);
	document.documentElement.setAttribute("data-theme", mode);
}

export function initThemeToggle(el: HTMLElement): () => void {
	const controller = new AbortController();

	const label = (mode: ThemeMode) => `Switch to ${mode === "light" ? "dark" : "light"} theme`;
	el.setAttribute("aria-label", label(currentMode()));

	el.addEventListener(
		"click",
		() => {
			const next: ThemeMode = currentMode() === "light" ? "dark" : "light";
			applyMode(next);
			el.setAttribute("aria-label", label(next));
		},
		{ signal: controller.signal },
	);

	return () => controller.abort();
}
