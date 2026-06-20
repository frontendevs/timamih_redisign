/**
 * ghSource.ts
 * GitHub Contents API bridge — replaces File System Access for web usage.
 * Reads/writes committed HTML source files via GitHub REST API.
 * Config (token + repo coordinates) is stored in localStorage.
 */

import type { Locale } from "../../shared/utils/locale.ts";
import { spliceArray, spliceAttr, spliceField } from "../../shared/utils/splice.ts";

const GH_API = "https://api.github.com";
const CONFIG_KEY = "ed-gh-config";

export interface GhConfig {
	token: string;
	owner: string;
	repo: string;
	branch: string;
}

export function loadConfig(): GhConfig | null {
	try {
		const raw = localStorage.getItem(CONFIG_KEY);
		return raw ? (JSON.parse(raw) as GhConfig) : null;
	} catch {
		return null;
	}
}

export function saveConfig(cfg: GhConfig): void {
	localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function clearConfig(): void {
	localStorage.removeItem(CONFIG_KEY);
}

function htmlPath(locale: Locale): string {
	return locale === "en" ? "pages/index.html" : `pages/${locale}/index.html`;
}

function toBase64(str: string): string {
	const bytes = new TextEncoder().encode(str);
	return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

function fromBase64(b64: string): string {
	const binary = atob(b64.replace(/\n/g, ""));
	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

interface GhFileResponse {
	content: string;
	sha: string;
}

async function ghGet(cfg: GhConfig, path: string): Promise<GhFileResponse> {
	const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`;
	const resp = await fetch(url, {
		headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" },
	});
	if (!resp.ok) throw new Error(`GitHub read ${resp.status}: ${await resp.text()}`);
	return resp.json() as Promise<GhFileResponse>;
}

async function ghPut(cfg: GhConfig, path: string, content: string, sha: string, message: string): Promise<void> {
	const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
	const resp = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${cfg.token}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ message, content: toBase64(content), sha, branch: cfg.branch }),
	});
	if (!resp.ok) throw new Error(`GitHub write ${resp.status}: ${await resp.text()}`);
}

export interface GhRepo {
	full_name: string;
	default_branch: string;
}

export async function fetchUserRepos(token: string): Promise<GhRepo[]> {
	const url = `${GH_API}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator`;
	const resp = await fetch(url, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
	});
	if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${await resp.text()}`);
	return resp.json() as Promise<GhRepo[]>;
}

export async function fetchBranches(token: string, owner: string, repo: string): Promise<string[]> {
	const url = `${GH_API}/repos/${owner}/${repo}/branches?per_page=100`;
	const resp = await fetch(url, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
	});
	if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${await resp.text()}`);
	const data = (await resp.json()) as Array<{ name: string }>;
	return data.map((b) => b.name);
}

export async function readSource(cfg: GhConfig, locale: Locale): Promise<string> {
	const file = await ghGet(cfg, htmlPath(locale));
	return fromBase64(file.content);
}

export async function writeField(cfg: GhConfig, locale: Locale, editId: string, escapedText: string): Promise<void> {
	const path = htmlPath(locale);
	const file = await ghGet(cfg, path);
	const next = spliceField(fromBase64(file.content), editId, escapedText);
	await ghPut(cfg, path, next, file.sha, `content: update ${editId}`);
}

export async function writeAttr(
	cfg: GhConfig,
	locale: Locale,
	editId: string,
	attrName: string,
	escapedValue: string,
): Promise<void> {
	const path = htmlPath(locale);
	const file = await ghGet(cfg, path);
	const next = spliceAttr(fromBase64(file.content), editId, attrName, escapedValue);
	await ghPut(cfg, path, next, file.sha, `content: update ${editId} [${attrName}]`);
}

export async function writeArray(cfg: GhConfig, locale: Locale, arrayId: string, items: string[]): Promise<void> {
	const path = htmlPath(locale);
	const file = await ghGet(cfg, path);
	const next = spliceArray(fromBase64(file.content), arrayId, items);
	await ghPut(cfg, path, next, file.sha, `content: update array ${arrayId}`);
}
