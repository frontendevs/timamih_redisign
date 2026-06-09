// stylelint-plugin-pseudo-class-nesting.js
// Rule: pseudo-class selectors must be nested inside their parent rule
// when that parent has its own declaration block.
//
// ✅ .btn { color: ...; &:focus { ... } }
// ❌ .btn:focus { }   — must be nested in .btn when .btn has declarations
// ✅ .skip-link:focus { } — valid when .skip-link would otherwise be an empty wrapper
//
// Note: :hover is excluded — it is handled by local/hover-requires-media.
// Note: :root, :host, :global, :where/:is/:not at root — excluded.

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/pseudo-class-requires-nesting";

const messages = {
	rejected: (selector) =>
		`Pseudo-class in "${selector}" must be nested inside the parent rule.\n` + `  Fix: .parent { &:pseudo-class { } }`,
};

const meta = { url: "" };

// Pseudo-classes that are intentionally used at root level — not flagged
const EXCLUDED = new Set([
	"hover", // handled by local/hover-requires-media
	"root", // :root — CSS variable scope
	"host", // Shadow DOM
	"global", // CSS Modules
]);

// Bare HTML tags — nesting pseudo inside tag { &:pseudo } is pointless
const HTML_TAGS = new Set([
	"a",
	"abbr",
	"address",
	"article",
	"aside",
	"audio",
	"b",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
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
	"embed",
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
	"head",
	"header",
	"hr",
	"html",
	"i",
	"iframe",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"link",
	"main",
	"map",
	"mark",
	"menu",
	"meta",
	"meter",
	"nav",
	"noscript",
	"object",
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
	"script",
	"search",
	"section",
	"select",
	"small",
	"source",
	"span",
	"strong",
	"style",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"template",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"title",
	"tr",
	"track",
	"u",
	"ul",
	"var",
	"video",
	"wbr",
]);

// Matches any pseudo-class that follows a base selector token
// e.g. ".skip-link:focus" — yes
// e.g. ":focus-within"    — no (no base before it)
const PSEUDO_CLASS_RE = /:(?!:)([\w-]+)/g;

/**
 * Returns the first violating pseudo-class info, or null if none.
 */
function getViolatingPseudo(selector) {
	PSEUDO_CLASS_RE.lastIndex = 0;
	let match;
	while ((match = PSEUDO_CLASS_RE.exec(selector)) !== null) {
		const name = match[1];
		if (EXCLUDED.has(name)) continue;

		const idx = match.index;

		// Skip pseudo-elements: the ':' is preceded by another ':'  (e.g. ::before → ':before')
		if (idx > 0 && selector[idx - 1] === ":") continue;

		// Skip bare :pseudo at the very start
		if (idx === 0) continue;

		// Skip pseudos inside parentheses — e.g. :focus-visible inside label:has(input:focus-visible)
		let depth = 0;
		for (let i = 0; i < idx; i++) {
			if (selector[i] === "(") depth++;
			else if (selector[i] === ")") depth--;
		}
		if (depth > 0) continue;

		// Skip when ':' follows a combinator (space, >, ~, +)
		// e.g. ".state :is(...)" — :is is a selector part, not a modifier
		const charBefore = selector[idx - 1];
		if (" \t>~+)]".includes(charBefore)) continue;

		// Skip if base is a bare HTML tag — label:has(...) at root is valid
		const base = selector.slice(0, idx).trim();
		if (HTML_TAGS.has(base.toLowerCase())) continue;

		return { name, base };
	}
	return null;
}

/**
 * True when the rule is at root level (not nested inside another rule).
 */
function isRootLevel(ruleNode) {
	const parent = ruleNode.parent;
	if (!parent) return false;
	if (parent.type === "root") return true;
	if (parent.type === "atrule" && parent.parent?.type === "root") return true;
	return false;
}

function hasDirectDeclarations(ruleNode) {
	return ruleNode.nodes?.some((node) => node.type === "decl") ?? false;
}

function collectRootSelectorsWithDeclarations(root) {
	const selectors = new Set();

	root.walkRules((ruleNode) => {
		if (!isRootLevel(ruleNode) || !hasDirectDeclarations(ruleNode)) return;

		for (const selector of ruleNode.selectors ?? [ruleNode.selector]) {
			const trimmed = selector.trim();
			if (!trimmed || trimmed.includes(":") || /[\s>~+]/.test(trimmed)) continue;
			selectors.add(trimmed);
		}
	});

	return selectors;
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	const rootSelectorsWithDeclarations = collectRootSelectorsWithDeclarations(root);

	root.walkRules((ruleNode) => {
		if (!isRootLevel(ruleNode)) return;

		const selectors = ruleNode.selectors ?? [ruleNode.selector];

		for (const selector of selectors) {
			const pseudoInfo = getViolatingPseudo(selector.trim());
			if (pseudoInfo) {
				if (!rootSelectorsWithDeclarations.has(pseudoInfo.base)) continue;

				result.warn(messages.rejected(selector.trim()), {
					node: ruleNode,
					ruleName,
					word: `:${pseudoInfo.name}`,
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
