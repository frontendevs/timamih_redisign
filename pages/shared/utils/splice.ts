/**
 * String-splice helpers for targeted HTML source edits.
 * Keyed on data-edit-id / data-edit-attr / array markers — never a full reserialize.
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

function escRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function spliceAttr(source: string, editId: string, attrName: string, escapedValue: string): string {
	const anchor = `data-edit-attr="${editId}:${attrName}"`;
	const anchorIdx = source.indexOf(anchor);
	if (anchorIdx === -1) throw new Error(`data-edit-attr not found: ${editId}:${attrName}`);

	let tagStart = anchorIdx;
	while (tagStart > 0 && source[tagStart] !== "<") tagStart--;

	let tagEnd = anchorIdx;
	while (tagEnd < source.length && source[tagEnd] !== ">") tagEnd++;

	const tag = source.slice(tagStart, tagEnd + 1);
	const attrRe = new RegExp(`(${escRe(attrName)}=")[^"]*(")`);
	if (!attrRe.test(tag)) throw new Error(`Attribute "${attrName}" not found in tag for ${editId}`);

	return source.slice(0, tagStart) + tag.replace(attrRe, `$1${escapedValue}$2`) + source.slice(tagEnd + 1);
}

export function spliceArray(source: string, arrayId: string, items: string[]): string {
	const startMarker = `<!-- array:${arrayId}:start -->`;
	const endMarker = `<!-- array:${arrayId}:end -->`;

	const startIdx = source.indexOf(startMarker);
	if (startIdx === -1) throw new Error(`Array start marker not found: ${arrayId}`);

	const endIdx = source.indexOf(endMarker);
	if (endIdx === -1) throw new Error(`Array end marker not found: ${arrayId}`);

	const lineStart = source.lastIndexOf("\n", endIdx);
	const rawIndent = lineStart === -1 ? "" : source.slice(lineStart + 1, endIdx);
	const indent = /^\s*$/.test(rawIndent) ? rawIndent : "";

	const body = items.length === 0 ? "" : indent + items.join("\n" + indent);

	const afterStart = startIdx + startMarker.length;
	return source.slice(0, afterStart) + "\n" + body + (body ? "\n" : "") + source.slice(endIdx);
}
