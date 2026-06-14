/**
 * shared/utils/escapeHtml.ts
 * Runtime HTML-entity escaping — ported from the removed prebuild `esc()`.
 *
 * The inline editor writes plain text back into the static HTML source files;
 * this keeps the persisted markup identical in form to the original generated
 * output (e.g. `'` → `&#x27;`, `&` → `&amp;`), so diffs stay minimal.
 */

const HTML_ENTITIES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
};

/** Escape the 5 HTML-significant characters. Plain-text in → safe-source out. */
export function esc(value: string): string {
	return value.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] ?? ch);
}
