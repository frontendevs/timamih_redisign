// stylelint-plugin-modifier-context.js
// Rule: selectors where a non-last token is a modifier must use inverted nesting.
//
// Detected patterns:
//   A — BEM double-dash:     .card--active .card__icon  (-- in context token)
//   B — shared prefix:       .audience-card-featured .audience-card-icon
//                            context base "audience-card" matches target prefix
//
// The modifier token is context; the last token is the target element.
//
//   ❌ .env-card--pos .env-card__icon { }
//   ✅ .env-card__icon { .env-card--pos & { } }
//
//   ❌ .audience-card-featured .audience-card-icon { }
//   ✅ .audience-card-icon { .audience-card-featured & { } }

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/modifier-context-requires-nesting";

const messages = {
	inverted: (selector, target, context) =>
		`"${selector}" — modifier context must use inverted nesting.\n` + `  Fix: ${target} { ${context} & { } }`,
};

const meta = { url: "" };

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

/** Rebuild a token list into a selector string. */
function rebuild(tokens) {
	return tokens.map(({ token, combinator }, i) => (i === 0 ? token : `${combinator}${token}`)).join("");
}

/** Extract all class names from a token string (handles compound selectors like .foo.bar). */
function classNames(token) {
	return [...token.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]);
}

/**
 * Pattern A — BEM double-dash modifier in context token.
 * .card--active, .btn--large, .chat-input-wrapper--loading
 */
function isBemModifier(token) {
	return token.includes("--");
}

/**
 * Pattern B — single-dash convention: the context token's class shares a
 * 2+-segment hyphenated prefix with a class in the target tokens.
 *
 * audience-card-featured → base "audience-card"
 * audience-card-icon     → starts with "audience-card-" ✓
 *
 * hero-section → base "hero" (1 segment) → skipped
 * flex-col     → base "flex" (1 segment) → skipped
 */
function getSharedPrefixBase(contextToken, targetTokens) {
	for (const name of classNames(contextToken)) {
		// Skip tokens that already have -- or __ (handled by Pattern A / structural BEM)
		if (name.includes("--") || name.includes("__")) continue;

		const lastDash = name.lastIndexOf("-");
		if (lastDash <= 0) continue;

		const base = name.slice(0, lastDash);
		// Require 2+ hyphen-separated segments in the base (e.g. "audience-card", not "hero")
		if (base.split("-").length < 2) continue;

		// Check if any class in any target token starts with this base
		const matched = targetTokens.some(({ token }) =>
			classNames(token).some((cls) => cls.startsWith(base + "-") || cls.startsWith(base + "__")),
		);
		if (matched) return base;
	}
	return null;
}

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
			const tokens = tokenize(trimmed);
			if (tokens.length < 2) continue;

			let modifierIdx = -1;

			// Pattern A: BEM --
			modifierIdx = tokens.findIndex(({ token }, i) => i < tokens.length - 1 && isBemModifier(token));

			// Pattern B: shared prefix (only if Pattern A not found)
			if (modifierIdx === -1) {
				for (let i = 0; i < tokens.length - 1; i++) {
					const base = getSharedPrefixBase(tokens[i].token, tokens.slice(i + 1));
					if (base !== null) {
						modifierIdx = i;
						break;
					}
				}
			}

			if (modifierIdx === -1) continue;

			const target = rebuild(tokens.slice(modifierIdx + 1));
			const context = rebuild(tokens.slice(0, modifierIdx + 1));

			result.warn(messages.inverted(trimmed, target, context), {
				node: ruleNode,
				ruleName,
				word: tokens[modifierIdx].token,
			});
			break;
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
