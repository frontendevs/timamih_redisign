/**
 * shared/ui/inlineEditor.ts
 * Makes [data-edit-id] elements editable inside a target document.
 *
 * Dev/editor-only — never imported by the public page entry, so no editor code
 * ships in the production build. Plain-text editing only (the content model is
 * plain text); on commit it reports (editId, text) to the caller, which escapes
 * and writes to the source file via fsSource.
 */

export interface InlineEditorOptions {
	/** The document to edit — the editor iframe's contentDocument. */
	doc: Document;
	/** Persist one field. Receives the raw (unescaped) plain text. */
	onSave: (editId: string, text: string) => Promise<void> | void;
	/** Optional status sink for the host toolbar. */
	onStatus?: (message: string, kind: "info" | "error") => void;
}

const STYLE_ID = "inline-editor-style";

const AFFORDANCE_CSS = `
	[data-edit-id] { outline: 1px dashed rgba(130,130,130,.5); outline-offset: 3px; cursor: text; border-radius: 2px; }
	[data-edit-id]:hover { outline-color: rgba(130,130,130,.9); }
	[data-edit-id]:focus { outline: 2px solid #3b82f6; }
	[data-edit-id][data-dirty="true"] { outline: 2px solid #f59e0b; }
`;

/** Activate inline editing; returns a cleanup that removes all listeners + affordances. */
export function initInlineEditor(options: InlineEditorOptions): () => void {
	const { doc, onSave, onStatus } = options;
	const controller = new AbortController();
	const { signal } = controller;

	if (!doc.getElementById(STYLE_ID)) {
		const style = doc.createElement("style");
		style.id = STYLE_ID;
		style.textContent = AFFORDANCE_CSS;
		doc.head.append(style);
	}

	const fields = doc.querySelectorAll<HTMLElement>("[data-edit-id]");
	const baseline = new WeakMap<HTMLElement, string>();

	for (const el of fields) {
		el.setAttribute("contenteditable", "plaintext-only");
		el.spellcheck = false;
		baseline.set(el, (el.textContent ?? "").trim());

		// Plain-text paste only — strip markup and collapse newlines.
		el.addEventListener(
			"paste",
			(event) => {
				event.preventDefault();
				const text = event.clipboardData?.getData("text/plain") ?? "";
				doc.execCommand("insertText", false, text.replace(/\r?\n/g, " "));
			},
			{ signal },
		);

		// Enter commits (single-line fields); blur triggers the save.
		el.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					el.blur();
				}
			},
			{ signal },
		);

		el.addEventListener(
			"input",
			() => {
				const dirty = (el.textContent ?? "").trim() !== baseline.get(el);
				el.setAttribute("data-dirty", String(dirty));
			},
			{ signal },
		);

		el.addEventListener(
			"blur",
			() => {
				const editId = el.getAttribute("data-edit-id");
				if (!editId) return;
				const text = (el.textContent ?? "").trim();
				if (text === baseline.get(el)) return;

				Promise.resolve(onSave(editId, text))
					.then(() => {
						baseline.set(el, text);
						el.removeAttribute("data-dirty");
						onStatus?.(`Saved ${editId}`, "info");
					})
					.catch((error: unknown) => {
						const message = error instanceof Error ? error.message : String(error);
						onStatus?.(`Save failed (${editId}): ${message}`, "error");
					});
			},
			{ signal },
		);
	}

	onStatus?.(`Editing ${fields.length} fields — click any highlighted text`, "info");
	return () => controller.abort();
}
