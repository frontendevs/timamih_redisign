// TEMP one-shot: export live DatoCMS content (en/ru/fi) → content/_raw/dato-<locale>.json
// Run: node plugins/_export-dato.mjs   ·  delete after content/ is built.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOKEN = "5375291f9b51358dac87d9147398c2";
const ENDPOINT = "https://graphql.datocms.com/";
const LOCALES = ["en", "ru", "fi"];

const query = `
  query Export($locale: SiteLocale) {
    _site { globalSeo(locale: $locale) { siteName facebookPageUrl titleSuffix
      fallbackSeo { description title image { url } } } }
    navigation(locale: $locale) { headerlinks { id name navanchor } }
    heroSection(locale: $locale) { label title description playButton mainVideoUrl chat { id message } }
    howwework(locale: $locale) { title steps { id title description } }
    whatweoffer(locale: $locale) { title services { id active order title description price buttonName illustration
      teammates { id recruit labelName title proff description isactivatedurl url avatar { url } } } }
    ourlittlestory(locale: $locale) { title description }
    getintouch(locale: $locale) { title description copyText tunnus contacts { id icon url } }
  }`;

const outDir = resolve("content/_raw");
mkdirSync(outDir, { recursive: true });

for (const locale of LOCALES) {
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
		body: JSON.stringify({ query, variables: { locale } }),
	});
	if (!res.ok) throw new Error(`${locale}: HTTP ${res.status} ${await res.text()}`);
	const json = await res.json();
	if (json.errors) throw new Error(`${locale}: ${JSON.stringify(json.errors, null, 2)}`);
	const file = resolve(outDir, `dato-${locale}.json`);
	writeFileSync(file, JSON.stringify(json.data, null, 2));
	console.log(`✓ ${locale} → ${file}`);
}
console.log("Done.");
