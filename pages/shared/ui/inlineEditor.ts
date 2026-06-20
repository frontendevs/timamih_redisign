/**
 * shared/ui/inlineEditor.ts
 * Makes [data-edit-id] elements editable and [data-edit-attr] elements
 * attribute-editable inside a target document.
 *
 * Dev/editor-only — never imported by public pages.
 *
 * Returns { cleanup, makeEditable }:
 *   cleanup     — removes all listeners and affordances
 *   makeEditable — wires a single [data-edit-id] element (used by arrayEditor
 *                  to activate fields in newly cloned items without an iframe reload)
 */

export interface InlineEditorOptions {
	/** The document to edit — the editor iframe's contentDocument. */
	doc: Document;
	/** Persist one text field. Receives raw (unescaped) plain text. */
	onSave: (editId: string, text: string) => Promise<void> | void;
	/** Persist one attribute change. Receives the raw (unescaped) value. */
	onAttrSave?: (editId: string, attrName: string, value: string) => Promise<void> | void;
	/** Optional status sink for the host toolbar. */
	onStatus?: (message: string, kind: "info" | "error") => void;
}

export interface InlineEditorHandle {
	cleanup: () => void;
	/** Make a single [data-edit-id] element editable (for dynamically added fields). */
	makeEditable: (el: HTMLElement) => void;
}

const STYLE_ID = "inline-editor-style";

/** Inject a tiny modal into the target doc and resolve with user input or null. */
function promptInDoc(doc: Document, label: string, defaultValue: string): Promise<string | null> {
	return new Promise((resolve) => {
		const overlay = doc.createElement("div");
		overlay.style.cssText =
			"position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);" +
			"display:flex;align-items:center;justify-content:center;";

		const box = doc.createElement("div");
		box.style.cssText =
			"background:#fff;border-radius:6px;padding:16px;min-width:280px;" +
			"box-shadow:0 4px 16px rgba(0,0,0,.3);font:14px system-ui,sans-serif;";

		const msg = doc.createElement("p");
		msg.textContent = label;
		msg.style.cssText = "margin:0 0 8px;color:#111;word-break:break-all;";

		const input = doc.createElement("input");
		input.type = "text";
		input.value = defaultValue;
		input.style.cssText =
			"width:100%;box-sizing:border-box;padding:5px 8px;" + "border:1px solid #aaa;border-radius:3px;font:inherit;";

		const btns = doc.createElement("div");
		btns.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-block-start:10px;";

		const cancelBtn = doc.createElement("button");
		cancelBtn.type = "button";
		cancelBtn.textContent = "Cancel";
		cancelBtn.style.cssText = "padding:3px 12px;cursor:pointer;border-radius:3px;border:1px solid #aaa;";

		const okBtn = doc.createElement("button");
		okBtn.type = "button";
		okBtn.textContent = "OK";
		okBtn.style.cssText =
			"padding:3px 12px;cursor:pointer;background:#3b82f6;color:#fff;" + "border:none;border-radius:3px;";

		const close = (value: string | null) => {
			overlay.remove();
			resolve(value);
		};

		cancelBtn.addEventListener("click", () => close(null));
		okBtn.addEventListener("click", () => close(input.value));
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close(null);
		});
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") close(input.value);
			if (e.key === "Escape") close(null);
		});

		btns.append(cancelBtn, okBtn);
		box.append(msg, input, btns);
		overlay.append(box);
		doc.body.append(overlay);
		input.focus();
		input.select();
	});
}

const AFFORDANCE_CSS = `
	[data-edit-id] { outline: 1px dashed rgba(130,130,130,.5); outline-offset: 3px; cursor: text; border-radius: 2px; }
	[data-edit-id]:hover { outline-color: rgba(130,130,130,.9); }
	[data-edit-id]:focus { outline: 2px solid #3b82f6; }
	[data-edit-id][data-dirty="true"] { outline: 2px solid #f59e0b; }
	[data-edit-attr] { outline: 1px dashed rgba(245,158,11,.5); outline-offset: 3px; border-radius: 2px; cursor: pointer; }
	[data-edit-attr]:hover { outline-color: rgba(245,158,11,.9); }
`;

/** Activate inline editing; returns cleanup + makeEditable for new fields. */
export function initInlineEditor(options: InlineEditorOptions): InlineEditorHandle {
	const { doc, onSave, onAttrSave, onStatus } = options;
	const controller = new AbortController();
	const { signal } = controller;
	const baseline = new WeakMap<HTMLElement, string>();

	if (!doc.getElementById(STYLE_ID)) {
		const style = doc.createElement("style");
		style.id = STYLE_ID;
		style.textContent = AFFORDANCE_CSS;
		doc.head.append(style);
	}

	// ── Text-field wiring ────────────────────────────────────────────────────

	const makeEditable = (el: HTMLElement) => {
		el.setAttribute("contenteditable", "plaintext-only");
		el.spellcheck = false;
		baseline.set(el, (el.textContent ?? "").trim());

		// Plain-text paste only — strip markup and collapse newlines.
		el.addEventListener(
			"paste",
			(event) => {
				event.preventDefault();
				const text = event.clipboardData?.getData("text/plain") ?? "";
				el.ownerDocument.execCommand("insertText", false, text.replace(/\r?\n/g, " "));
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
	};

	// Wire all existing text fields.
	const fields = doc.querySelectorAll<HTMLElement>("[data-edit-id]");
	for (const el of fields) makeEditable(el);

	// ── Attribute-field wiring ────────────────────────────────────────────────

	if (onAttrSave) {
		for (const el of doc.querySelectorAll<HTMLElement>("[data-edit-attr]")) {
			el.addEventListener(
				"click",
				(event) => {
					event.preventDefault();
					const spec = el.getAttribute("data-edit-attr") ?? "";
					const colonIdx = spec.indexOf(":");
					if (colonIdx === -1) return;
					const editId = spec.slice(0, colonIdx);
					const attrName = spec.slice(colonIdx + 1);
					const current = el.getAttribute(attrName) ?? "";

					void promptInDoc(doc, `Edit ${editId} (${attrName}):`, current).then((next) => {
						if (next === null || next === current) return;
						el.setAttribute(attrName, next);
						Promise.resolve(onAttrSave(editId, attrName, next))
							.then(() => onStatus?.(`Saved attr ${editId}`, "info"))
							.catch((err: unknown) => {
								const msg = err instanceof Error ? err.message : String(err);
								onStatus?.(`Attr save failed (${editId}): ${msg}`, "error");
							});
					});
				},
				{ signal },
			);
		}
	}

	onStatus?.(`Editing ${fields.length} fields — click any highlighted text`, "info");

	return {
		cleanup: () => controller.abort(),
		makeEditable,
	};
}
