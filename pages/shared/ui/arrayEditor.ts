/**
 * shared/ui/arrayEditor.ts
 * Add / delete / reorder support for [data-array] containers.
 * Editor-only — never imported by public pages.
 *
 * Two ctrl strategies depending on container tag:
 *   - list (ul/ol): controls injected INSIDE each item as position:absolute
 *     overlay — avoids disrupting list-based layouts (e.g. carousels).
 *   - block (div/section/…): controls injected as preceding sibling elements.
 *
 * Source persistence: structural changes re-serialize the full array DOM state
 * and call onArraySave, which writes back via spliceArray.
 */

export interface ArrayEditorOptions {
	doc: Document;
	onArraySave: (arrayId: string, items: string[]) => Promise<void>;
	onStatus?: (msg: string, kind: "info" | "error") => void;
	/** Called for each [data-edit-id] field inside a newly cloned item. */
	makeEditable: (el: HTMLElement) => void;
}

const CTRL_ATTR = "data-array-ctrl";

// ── Serialization ─────────────────────────────────────────────────────────────

function cleanClone(clone: Element): void {
	for (const el of clone.querySelectorAll("[contenteditable]")) {
		el.removeAttribute("contenteditable");
		el.removeAttribute("spellcheck");
		el.removeAttribute("data-dirty");
	}
	for (const el of clone.querySelectorAll(`[${CTRL_ATTR}]`)) el.remove();
	// Remove inline position:relative injected for list-strategy items.
	// Then strip the attribute entirely if it became empty to keep source clean.
	for (const el of [clone, ...clone.querySelectorAll<HTMLElement>("[style]")]) {
		const htmlEl = el as HTMLElement;
		if (htmlEl.style?.position === "relative") htmlEl.style.removeProperty("position");
		if (htmlEl.getAttribute?.("style") === "") htmlEl.removeAttribute("style");
	}
}

function renumberIds(clone: Element, arrayId: string, newIndex: number): void {
	const prefix = arrayId + ".";

	const update = (el: Element) => {
		const id = el.getAttribute("data-edit-id");
		if (!id?.startsWith(prefix)) return;
		const tail = id.slice(prefix.length);
		const dot = tail.indexOf(".");
		const suffix = dot === -1 ? "" : tail.slice(dot);
		el.setAttribute("data-edit-id", `${arrayId}.${newIndex}${suffix}`);
	};

	if (clone.hasAttribute("data-edit-id")) update(clone);
	for (const el of clone.querySelectorAll("[data-edit-id]")) update(el);
}

function serializeItems(arrayEl: Element, arrayId: string): string[] {
	return [...arrayEl.querySelectorAll<Element>(":scope > [data-array-item]")].map((item, i) => {
		const clone = item.cloneNode(true) as Element;
		cleanClone(clone);
		clone.setAttribute("data-array-item", String(i));
		renumberIds(clone, arrayId, i);
		return clone.outerHTML;
	});
}

// ── Template ──────────────────────────────────────────────────────────────────

function cloneTemplate(doc: Document, arrayId: string, index: number): Element | null {
	const tpl = doc.querySelector<HTMLTemplateElement>(`template[data-array-template="${arrayId}"]`);
	if (!tpl?.content.firstElementChild) return null;

	const clone = tpl.content.firstElementChild.cloneNode(true) as Element;
	clone.setAttribute("data-array-item", String(index));

	const resolve = (el: Element) => {
		const field = el.getAttribute("data-edit-id-template");
		if (field === null) return;
		const fullId = field ? `${arrayId}.${index}.${field}` : `${arrayId}.${index}`;
		el.setAttribute("data-edit-id", fullId);
		el.removeAttribute("data-edit-id-template");
	};

	if (clone.hasAttribute("data-edit-id-template")) resolve(clone);
	for (const el of clone.querySelectorAll("[data-edit-id-template]")) resolve(el);

	return clone;
}

// ── Controls ──────────────────────────────────────────────────────────────────

function makeBtn(doc: Document, label: string, extra?: string): HTMLButtonElement {
	const btn = doc.createElement("button");
	btn.type = "button";
	btn.textContent = label;
	btn.style.cssText =
		"font:11px/1.4 monospace;padding:1px 7px;cursor:pointer;" +
		"background:#fff;border:1px solid #aaa;border-radius:3px;" +
		(extra ?? "");
	return btn;
}

function prevItem(arrayEl: Element, item: HTMLElement): HTMLElement | null {
	const items = [...arrayEl.querySelectorAll<HTMLElement>(":scope > [data-array-item]")];
	const idx = items.indexOf(item);
	return idx > 0 ? items[idx - 1] : null;
}

function nextItem(arrayEl: Element, item: HTMLElement): HTMLElement | null {
	const items = [...arrayEl.querySelectorAll<HTMLElement>(":scope > [data-array-item]")];
	const idx = items.indexOf(item);
	return idx < items.length - 1 ? items[idx + 1] : null;
}

/**
 * List strategy: inject an absolute-positioned overlay INSIDE the item.
 * Keeps the list structure intact (no extra <li> siblings disrupting layouts).
 */
function attachListControls(arrayEl: Element, item: HTMLElement, save: () => void): void {
	(item as HTMLElement).style.position = "relative";

	const row = item.ownerDocument.createElement("div");
	row.setAttribute(CTRL_ATTR, "");
	row.style.cssText =
		"position:absolute;top:4px;inset-inline-end:4px;z-index:100;" +
		"display:flex;gap:4px;padding:2px 6px;" +
		"background:rgba(255,255,255,.92);border-radius:4px;" +
		"border:1px solid rgba(59,130,246,.3);box-shadow:0 1px 4px rgba(0,0,0,.12);";

	const up = makeBtn(item.ownerDocument, "↑");
	const dn = makeBtn(item.ownerDocument, "↓");
	const del = makeBtn(item.ownerDocument, "✕", "color:#b91c1c;");

	up.addEventListener("click", () => {
		const prev = prevItem(arrayEl, item);
		if (prev) arrayEl.insertBefore(item, prev);
		save();
	});
	dn.addEventListener("click", () => {
		const next = nextItem(arrayEl, item);
		if (next) next.after(item);
		save();
	});
	del.addEventListener("click", () => {
		item.remove();
		save();
	});

	row.append(up, dn, del);
	item.append(row);
}

/**
 * Block strategy: insert a sibling row BEFORE the item.
 * Works for div/section containers where sibling elements don't break layout.
 */
function attachBlockControls(arrayEl: Element, item: HTMLElement, save: () => void): void {
	const row = item.ownerDocument.createElement("div");
	row.setAttribute(CTRL_ATTR, "");
	row.style.cssText =
		"display:flex;gap:4px;padding:2px 6px;" +
		"background:rgba(59,130,246,.07);border-top:1px dashed rgba(59,130,246,.25);";

	const up = makeBtn(item.ownerDocument, "↑");
	const dn = makeBtn(item.ownerDocument, "↓");
	const del = makeBtn(item.ownerDocument, "✕ del", "color:#b91c1c;");

	up.addEventListener("click", () => {
		const prev = prevItem(arrayEl, item);
		if (!prev) return;
		const prevRow = prev.previousElementSibling;
		if (prevRow?.hasAttribute(CTRL_ATTR)) {
			arrayEl.insertBefore(row, prevRow);
			arrayEl.insertBefore(item, prevRow);
		}
		save();
	});
	dn.addEventListener("click", () => {
		const next = nextItem(arrayEl, item);
		if (!next) return;
		const nextRow = next.previousElementSibling;
		if (nextRow?.hasAttribute(CTRL_ATTR)) {
			arrayEl.insertBefore(nextRow, row);
			arrayEl.insertBefore(next, row);
		}
		save();
	});
	del.addEventListener("click", () => {
		row.remove();
		item.remove();
		save();
	});

	row.append(up, dn, del);
	item.before(row);
}

function attachControls(arrayEl: Element, item: HTMLElement, save: () => void): void {
	const tag = arrayEl.tagName;
	if (tag === "UL" || tag === "OL") {
		attachListControls(arrayEl, item, save);
	} else {
		attachBlockControls(arrayEl, item, save);
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initArrayEditor(options: ArrayEditorOptions): () => void {
	const { doc, onArraySave, onStatus, makeEditable } = options;

	for (const arrayEl of doc.querySelectorAll<HTMLElement>("[data-array]")) {
		const arrayId = arrayEl.getAttribute("data-array") ?? "";
		if (!arrayId) continue;

		const save = () => {
			const items = serializeItems(arrayEl, arrayId);
			void onArraySave(arrayId, items)
				.then(() => onStatus?.(`Saved array ${arrayId}`, "info"))
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					onStatus?.(`Array save failed (${arrayId}): ${msg}`, "error");
				});
		};

		for (const item of arrayEl.querySelectorAll<HTMLElement>(":scope > [data-array-item]")) {
			attachControls(arrayEl, item, save);
		}

		const addBtn = doc.createElement("button");
		addBtn.type = "button";
		addBtn.textContent = "+ Add item";
		addBtn.setAttribute(CTRL_ATTR, "add");
		addBtn.style.cssText =
			"display:block;margin:6px 0;padding:3px 12px;cursor:pointer;" +
			"background:#f0f9ff;border:1px dashed #3b82f6;border-radius:4px;" +
			"font:12px/1.5 monospace;color:#1d4ed8;";

		addBtn.addEventListener("click", () => {
			const count = arrayEl.querySelectorAll(":scope > [data-array-item]").length;
			const newItem = cloneTemplate(doc, arrayId, count);
			if (!newItem) {
				onStatus?.(`No template found for "${arrayId}"`, "error");
				return;
			}

			attachControls(arrayEl, newItem as HTMLElement, save);
			arrayEl.append(newItem);

			if ((newItem as HTMLElement).hasAttribute("data-edit-id")) {
				makeEditable(newItem as HTMLElement);
			}
			for (const el of newItem.querySelectorAll<HTMLElement>("[data-edit-id]")) {
				makeEditable(el);
			}

			save();
		});

		arrayEl.after(addBtn);
	}

	return () => {
		for (const el of doc.querySelectorAll(`[${CTRL_ATTR}]`)) el.remove();
		for (const el of doc.querySelectorAll<HTMLElement>("[data-array-item]")) {
			el.style.removeProperty("position");
		}
	};
}
