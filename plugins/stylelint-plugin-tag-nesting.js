// stylelint-plugin-tag-nesting.js
// Rule: compound selectors ending in a bare HTML tag must be written as nested rules.
//
// ✅ .card { & span { } }
// ✅ .card { & h2 { } }
// ❌ .card span { }           — descendant tag must be nested in .card
// ❌ .card > h2 { }           — child tag must be nested in .card
// ❌ .card .inner span { }    — nested tag must be nested in .card .inner

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/tag-selector-requires-nesting";

const messages = {
	rejected: (selector) =>
		`Tag selector in "${selector}" must be nested inside the parent rule.\n` + `  Fix: .parent { & tag { } }`,
};

const meta = { url: "" };

const HTML_TAGS = new Set([
	"a",
	"abbr",
	"address",
	"article",
	"aside",
	"b",
	"blockquote",
	"br",
	"button",
	"caption",
	"cite",
	"code",
	"col",
	"colgroup",
	"data",
	"datalist",
	"dd",
	"del",
	"details",
	"dfn",
	"dialog",
	"div",
	"dl",
	"dt",
	"em",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"i",
	"iframe",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"main",
	"mark",
	"menu",
	"meter",
	"nav",
	"ol",
	"optgroup",
	"option",
	"output",
	"p",
	"picture",
	"pre",
	"progress",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"section",
	"select",
	"small",
	"source",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"track",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
]);

/**
 * Returns the last simple selector token from a compound selector string.
 * e.g. ".card span"  → "span"
 *      ".card > h2"  → "h2"
 *      ".card .inner span" → "span"
 *      ".card .inner"  → ".inner"  (no tag → ignored)
 */
function getLastToken(selector) {
	// Split by combinators: space, >, ~, +
	const tokens = selector
		.split(/\s*[\s>~+]\s*/)
		.map((t) => t.trim())
		.filter(Boolean);
	return tokens[tokens.length - 1] ?? "";
}

/**
 * True if the token is a bare HTML tag (no leading ., #, [, :, &).
 */
function isBareTag(token) {
	if (!token || /^[.#[:&*]/.test(token)) return false;
	// Strip pseudo-elements/classes from the token to get the base
	const base = token.split(/[:[]/)[0];
	return HTML_TAGS.has(base);
}

/**
 * True if the selector is a compound selector (has a descendant / combinator).
 * Pure single-token selectors like "span" are already caught by no-root-tag-selector.
 */
function isCompound(selector) {
	return /[\s>~+]/.test(selector.trim());
}

/**
 * The rule is "root level" when its parent is Root, or a top-level @layer/@media/@container.
 * Nested rules (inside another rule) are already scoped — skip them.
 */
function isRootLevel(ruleNode) {
	const parent = ruleNode.parent;
	if (!parent) return false;
	if (parent.type === "root") return true;
	if (parent.type === "atrule" && parent.parent?.type === "root") return true;
	return false;
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkRules((ruleNode) => {
		if (!isRootLevel(ruleNode)) return;

		const selectors = ruleNode.selectors ?? [ruleNode.selector];

		for (const selector of selectors) {
			const trimmed = selector.trim();
			if (!isCompound(trimmed)) continue;

			const lastToken = getLastToken(trimmed);
			if (isBareTag(lastToken)) {
				result.warn(messages.rejected(trimmed), {
					node: ruleNode,
					ruleName,
					word: lastToken,
				});
				break;
			}
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
