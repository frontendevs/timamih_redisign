/**
 * edit/scripts/edit.ts
 * Dev-only inline editor host. NOT in the production rollup input, so it never
 * ships to GitHub Pages. Loads a locale page in an iframe and, once the user
 * grants the repo `pages/` folder, makes its [data-edit-id] text editable.
 *
 * Gates (defense in depth):
 *   1. excluded from the production build (not a rollupOptions input);
 *   2. refuses to run off localhost;
 *   3. editing activates only after a File System Access directory grant.
 */

import { initInlineEditor } from "../../shared/ui/inlineEditor.ts";
import { esc } from "../../shared/utils/escapeHtml.ts";
import { type FsDirHandle, isFsSupported, pickPagesDir, writeField } from "../../shared/utils/fsSource.ts";
import { isLocale, type Locale } from "../../shared/utils/locale.ts";

function req<T extends HTMLElement>(role: string): T {
	const el = document.querySelector<T>(`[data-js="${role}"]`);
	if (!el) throw new Error(`Missing [data-js="${role}"]`);
	return el;
}

const statusEl = req<HTMLElement>("ed-status");
const frame = req<HTMLIFrameElement>("ed-frame");
const openBtn = req<HTMLButtonElement>("ed-open");
const localeBtns = document.querySelectorAll<HTMLButtonElement>('[data-js="ed-loc"]');

function setStatus(message: string, kind: "info" | "error" = "info"): void {
	statusEl.textContent = message;
	statusEl.setAttribute("data-kind", kind);
}

let dir: FsDirHandle | null = null;
let currentLocale: Locale = "en";
let teardown: (() => void) | null = null;

function localePath(locale: Locale): string {
	return locale === "en" ? "./index.html" : `./${locale}/index.html`;
}

/** Mount editing onto the freshly loaded iframe — but only once a folder is granted. */
function onFrameLoad(): void {
	teardown?.();
	teardown = null;

	if (!dir) {
		setStatus("Preview only — open the pages/ folder to edit.");
		return;
	}
	const doc = frame.contentDocument;
	if (!doc) {
		setStatus("Could not access the preview document.", "error");
		return;
	}
	teardown = initInlineEditor({
		doc,
		onStatus: setStatus,
		onSave: async (editId, text) => {
			if (!dir) throw new Error("Folder not opened");
			await writeField(dir, currentLocale, editId, esc(text));
		},
	});
}

function selectLocale(locale: Locale): void {
	currentLocale = locale;
	for (const b of localeBtns) b.removeAttribute("data-current");
	for (const b of localeBtns) {
		if (b.getAttribute("data-locale") === locale) b.setAttribute("data-current", "true");
	}
	frame.src = localePath(locale); // triggers onFrameLoad
}

// ── Guards ──────────────────────────────────────────────────────────────────

const onLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

if (!onLocalhost) {
	setStatus("The editor runs only on localhost.", "error");
	openBtn.disabled = true;
} else if (!isFsSupported()) {
	setStatus("This browser lacks the File System Access API — use a Chromium browser.", "error");
	openBtn.disabled = true;
} else {
	setStatus("Open the pages/ folder to start editing.");
}

// ── Wiring ────────────────────────────────────────────────────────────────────

frame.addEventListener("load", () => {
	if (frame.getAttribute("src")) onFrameLoad();
});

for (const btn of localeBtns) {
	btn.addEventListener("click", () => {
		const loc = btn.getAttribute("data-locale");
		if (loc && isLocale(loc)) selectLocale(loc);
	});
}

openBtn.addEventListener("click", () => {
	void (async () => {
		try {
			dir = await pickPagesDir();
			setStatus("Folder ready — editing enabled.");
			if (frame.contentDocument && frame.getAttribute("src")) {
				onFrameLoad(); // already-loaded preview → activate editing now
			} else {
				selectLocale(currentLocale);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			setStatus(`Folder access failed: ${message}`, "error");
		}
	})();
});

// Initial read-only preview of the default locale.
if (onLocalhost) selectLocale("en");
