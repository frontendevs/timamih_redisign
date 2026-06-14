/**
 * shared/utils/fsSource.ts
 * File System Access bridge — reads/writes the committed HTML source files.
 *
 * Phase 1 persistence with zero secrets: the editor (dev/localhost only) lets
 * the user grant the repo `pages/` directory, then writes edits straight to disk.
 * The user commits via git afterwards. No token, no server, no Worker.
 *
 * Writes use targeted string-splice keyed on `data-edit-id` — never a full
 * DOMParser reserialize (which would reflow whitespace/entities into a huge diff).
 * Every Phase-1 anchor is a leaf element whose inner content is plain text.
 */

import type { Locale } from "./locale.ts";

// ── Minimal File System Access API types (lib.dom may not ship them) ───────────

interface FsWritable {
	write(data: string): Promise<void>;
	close(): Promise<void>;
}

interface FsFileHandle {
	getFile(): Promise<File>;
	createWritable(): Promise<FsWritable>;
}

export interface FsDirHandle {
	getDirectoryHandle(name: string): Promise<FsDirHandle>;
	getFileHandle(name: string): Promise<FsFileHandle>;
	requestPermission?(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

declare global {
	interface Window {
		showDirectoryPicker?(opts?: { mode?: "read" | "readwrite" }): Promise<FsDirHandle>;
	}
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** True when the browser supports File System Access (Chromium). */
export function isFsSupported(): boolean {
	return typeof window.showDirectoryPicker === "function";
}

/** Prompt for the repo `pages/` directory and request read-write access. */
export async function pickPagesDir(): Promise<FsDirHandle> {
	if (!window.showDirectoryPicker) {
		throw new Error("File System Access API is unavailable in this browser.");
	}
	const dir = await window.showDirectoryPicker({ mode: "readwrite" });
	const perm = await dir.requestPermission?.({ mode: "readwrite" });
	if (perm && perm !== "granted") {
		throw new Error("Read-write permission to the folder was not granted.");
	}
	return dir;
}

/** Resolve the file handle for one locale's source HTML, relative to `pages/`. */
async function fileHandleFor(dir: FsDirHandle, locale: Locale): Promise<FsFileHandle> {
	if (locale === "en") return dir.getFileHandle("index.html");
	const sub = await dir.getDirectoryHandle(locale);
	return sub.getFileHandle("index.html");
}

/** Read the raw source HTML for a locale (the ground truth, not the live DOM). */
export async function readSource(dir: FsDirHandle, locale: Locale): Promise<string> {
	const handle = await fileHandleFor(dir, locale);
	return (await handle.getFile()).text();
}

/**
 * Replace the inner text of the element bearing `data-edit-id="<editId>"`.
 * Leaf-only: inner region runs from the opening tag's `>` to the next `</`.
 */
export function spliceField(source: string, editId: string, escapedText: string): string {
	const marker = `data-edit-id="${editId}"`;
	const markerIdx = source.indexOf(marker);
	if (markerIdx === -1) throw new Error(`data-edit-id not found in source: ${editId}`);

	const openEnd = source.indexOf(">", markerIdx);
	if (openEnd === -1) throw new Error(`Malformed opening tag for: ${editId}`);

	const closeStart = source.indexOf("</", openEnd);
	if (closeStart === -1) throw new Error(`No closing tag for: ${editId}`);

	return source.slice(0, openEnd + 1) + escapedText + source.slice(closeStart);
}

/** Read → splice one field → write back. Returns when the file is flushed. */
export async function writeField(dir: FsDirHandle, locale: Locale, editId: string, escapedText: string): Promise<void> {
	const handle = await fileHandleFor(dir, locale);
	const source = await (await handle.getFile()).text();
	const next = spliceField(source, editId, escapedText);

	const writable = await handle.createWritable();
	await writable.write(next);
	await writable.close();
}
