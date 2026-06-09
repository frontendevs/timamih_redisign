// TEMP one-shot: download team avatars from datocms-assets → public/assets/images/team/
// Run: node plugins/_download-avatars.mjs  ·  delete after assets are local.
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const raw = JSON.parse(
	await import("node:fs/promises").then((fs) => fs.readFile(resolve("content/_raw/dato-en.json"), "utf8")),
);
const urls = new Set();
for (const s of raw.whatweoffer.services) for (const t of s.teammates) urls.add(t.avatar.url);

const outDir = resolve("public/assets/images/team");
mkdirSync(outDir, { recursive: true });

for (const url of urls) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	// strip datocms timestamp prefix "1657817162-igor_ivanov.webp" -> "igor_ivanov.webp"
	const name = basename(new URL(url).pathname).replace(/^\d+-/, "");
	writeFileSync(resolve(outDir, name), buf);
	console.log(`✓ ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
}
console.log(`Done. ${urls.size} avatars → ${outDir}`);
