// stylelint-plugin-nesting-context.js
// Rule: selectors with pseudo-classes must use CSS nesting.
//
// Pattern A — single token with a real base block:
//   ❌ .btn:focus { }
//   ✅ .btn { color: ...; &:focus { } }
//   ✅ .skip-link:focus { } — valid when .skip-link would otherwise be an empty wrapper
//
// Pattern B — pseudo on last token, has preceding context:
//   ❌ .container .btn:nth-child(2) { }
//   ✅ .btn { .container &:nth-child(2) { } }    ← inverted
//
//   ❌ .container > .btn:nth-child(2) { }
//   ✅ .btn { .container > &:nth-child(2) { } }  ← combinator preserved
//
// Pattern C — pseudo on non-last token:
//   ❌ .parent:nth-child(2) .child { }
//   ✅ .child { .parent:nth-child(2) & { } }     ← inverted
//
// :hover is excluded — handled by local/hover-requires-media.

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/nesting-context";

const messages = {
	direct: (selector, base, pseudo) => `"${selector}" — nest inside the rule.\n` + `  Fix: ${base} { &${pseudo} { } }`,
	inverted: (selector, target, context) =>
		`"${selector}" — use inverted nesting inside the target.\n` + `  Fix: ${target} { ${context} { } }`,
};

const meta = { url: "" };

const EXCLUDED = new Set(["hover", "root", "host", "global"]);

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

/**
 * Tokenize a selector into parts split by combinators,
 * respecting parentheses/brackets depth.
 * Returns [{ token, combinator }] where combinator preceded this token.
 */
function tokenize(selector) {
	const tokens = [];
	let depth = 0;
	let current = "";
	let combinator = "";

	for (let i = 0; i < selector.length; i++) {
		const ch = selector[i];

		if (ch === "(" || ch === "[") {
			depth++;
			current += ch;
			continue;
		}
		if (ch === ")" || ch === "]") {
			depth--;
			current += ch;
			continue;
		}
		if (depth > 0) {
			current += ch;
			continue;
		}

		if (ch === ">" || ch === "~" || ch === "+") {
			if (current.trim()) tokens.push({ token: current.trim(), combinator });
			combinator = ch;
			current = "";
			continue;
		}
		if (ch === " ") {
			if (current.trim()) {
				tokens.push({ token: current.trim(), combinator });
				combinator = " ";
				current = "";
			}
			continue;
		}
		current += ch;
	}
	if (current.trim()) tokens.push({ token: current.trim(), combinator });
	return tokens;
}

/**
 * Find the first non-excluded pseudo-class in a token at depth 0.
 * Returns the full pseudo string (e.g. ':nth-child(2)') or null.
 * Skips pseudo-elements (::) by checking both neighboring colons.
 * Collects all top-level pseudos and returns null if the only
 * non-excluded ones are followed exclusively by excluded ones
 * (e.g. :not(:disabled):hover — :hover is excluded, so :not is the trigger,
 * but the selector as a whole is a hover-media pattern — skip it).
 */
function findPseudo(token) {
	let depth = 0;
	const pseudos = []; // { name, full, index }

	for (let i = 0; i < token.length; i++) {
		const ch = token[i];
		if (ch === "(" || ch === "[") {
			depth++;
			continue;
		}
		if (ch === ")" || ch === "]") {
			depth--;
			continue;
		}
		if (depth > 0) continue;

		if (ch === ":") {
			if (token[i + 1] === ":") continue;
			if (i > 0 && token[i - 1] === ":") continue;

			let j = i + 1;
			while (j < token.length && /[\w-]/.test(token[j])) j++;
			const name = token.slice(i + 1, j);
			if (!name) continue;

			// Include args: :nth-child(2)
			if (token[j] === "(") {
				let d = 1;
				j++;
				while (j < token.length && d > 0) {
					if (token[j] === "(") d++;
					if (token[j] === ")") d--;
					j++;
				}
			}
			pseudos.push({ name, full: token.slice(i, j), index: i });
		}
	}

	if (pseudos.length === 0) return null;

	// If all top-level pseudos are excluded — no violation
	const nonExcluded = pseudos.filter((p) => !EXCLUDED.has(p.name));
	if (nonExcluded.length === 0) return null;

	// If the last top-level pseudo is excluded (e.g. :hover),
	// the selector belongs to a hover/media pattern — skip entirely
	const last = pseudos[pseudos.length - 1];
	if (EXCLUDED.has(last.name)) return null;

	return nonExcluded[0].full;
}

/** Rebuild a token list into a selector string, preserving combinators. */
function rebuild(tokens) {
	return tokens
		.map(({ token, combinator }, i) => {
			if (i === 0) return token;
			// Pad non-space combinators with spaces for readability
			return combinator === " " ? ` ${token}` : ` ${combinator} ${token}`;
		})
		.join("");
}

/**
 * Rebuild the context part for Pattern B inverted nesting.
 * The last token's combinator becomes the bridge: prefix > &:pseudo
 *
 * tokens = [{ token: ".container", combinator: "" }, { token: ".btn:nth-child(2)", combinator: ">" }]
 * → preceding = ".container", lastCombinator = ">", base = ".btn", pseudo = ":nth-child(2)"
 * → context = ".container > &:nth-child(2)"
 */
function buildPatternBContext(precedingTokens, lastCombinator, base, pseudo) {
	const preceding = rebuild(precedingTokens);
	const bridge = lastCombinator === " " ? " " : ` ${lastCombinator} `;
	return `${preceding}${bridge}&${pseudo}`;
}

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
			const trimmed = selector.trim();
			const tokens = tokenize(trimmed);
			if (tokens.length === 0) continue;

			const pseudoIdx = tokens.findIndex(({ token }) => findPseudo(token) !== null);
			if (pseudoIdx === -1) continue;

			const pseudoToken = tokens[pseudoIdx].token;
			const pseudo = findPseudo(pseudoToken);
			const isOnLastToken = pseudoIdx === tokens.length - 1;

			if (tokens.length === 1) {
				// Pattern A — single token: .btn:focus
				const base = pseudoToken.slice(0, pseudoToken.indexOf(pseudo));
				if (!base || base === "*") continue;
				// Bare HTML tag at root — label:has(...) is valid, no nesting needed
				if (HTML_TAGS.has(base.toLowerCase())) continue;
				if (!rootSelectorsWithDeclarations.has(base)) continue;

				result.warn(messages.direct(trimmed, base, pseudo), {
					node: ruleNode,
					ruleName,
					word: pseudo,
				});
			} else if (isOnLastToken) {
				// Pattern B — pseudo on last token, has preceding context
				// .container > .btn:nth-child(2) → .btn { .container > &:nth-child(2) { } }
				const base = pseudoToken.slice(0, pseudoToken.indexOf(pseudo));
				if (!base) continue;
				const precedingTokens = tokens.slice(0, pseudoIdx);
				const lastCombinator = tokens[pseudoIdx].combinator;
				const context = buildPatternBContext(precedingTokens, lastCombinator, base, pseudo);
				result.warn(messages.inverted(trimmed, base, context), {
					node: ruleNode,
					ruleName,
					word: pseudo,
				});
			} else {
				// Pattern C — pseudo on non-last token
				// .parent:nth-child(2) .child → .child { .parent:nth-child(2) & { } }
				const parentPart = rebuild(tokens.slice(0, pseudoIdx + 1));
				const childPart = rebuild(tokens.slice(pseudoIdx + 1)).trimStart();
				if (!childPart) continue;
				result.warn(messages.inverted(trimmed, childPart, `${parentPart} &`), {
					node: ruleNode,
					ruleName,
					word: pseudo,
				});
			}
			break;
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
