// stylelint-plugin-is-grouping.js
// Rule: comma-separated selectors sharing the same prefix must be grouped with :is().
//
// ✅ .hero.revealed :is(.title, .subtitle) { }
// ❌ .hero.revealed .title,
//    .hero.revealed .subtitle { }   — same prefix, use :is()
//
// Nested rules using & are excluded — they express different nesting semantics
// and false-positive when sibling & variants share a common ancestor token.
// ✅ .btn { &.is-active, &.is-loading { } }   — & variants, not :is() candidates

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/use-is-grouping";

const messages = {
	rejected: (prefix, suffixes) =>
		`Selectors share prefix "${prefix}" — group with :is().\n` + `  Fix: ${prefix} :is(${suffixes.join(", ")}) { }`,
};

const meta = { url: "" };

/**
 * True when the rule is at root level (not nested inside another rule).
 * Nested rules (inside a selector rule) are scoped — skip them.
 */
function isRootLevel(ruleNode) {
	const parent = ruleNode.parent;
	if (!parent) return false;
	if (parent.type === "root") return true;
	if (parent.type === "atrule" && parent.parent?.type === "root") return true;
	return false;
}

/**
 * Split a selector at the last combinator (space, >, ~, +),
 * ignoring combinators inside parentheses or brackets.
 * Returns { prefix, suffix } or null if no combinator found.
 */
function splitAtLastCombinator(selector) {
	let depth = 0;
	for (let i = selector.length - 1; i >= 0; i--) {
		const ch = selector[i];
		if (ch === ")" || ch === "]") {
			depth++;
			continue;
		}
		if (ch === "(" || ch === "[") {
			depth--;
			continue;
		}
		if (depth !== 0) continue;

		if (ch === ">" || ch === "~" || ch === "+") {
			const prefix = selector.slice(0, i).trimEnd();
			const suffix = selector.slice(i + 1).trimStart();
			if (prefix && suffix) return { prefix, suffix };
		}

		if (ch === " ") {
			// Skip multiple spaces
			let j = i;
			while (j > 0 && selector[j - 1] === " ") j--;
			const prefix = selector.slice(0, j);
			const suffix = selector.slice(i + 1).trimStart();
			if (prefix && suffix) return { prefix, suffix };
		}
	}
	return null;
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkRules((ruleNode) => {
		// Only check root-level rules — nested & rules have different semantics
		if (!isRootLevel(ruleNode)) return;

		const selectors = ruleNode.selectors ?? [ruleNode.selector];
		if (selectors.length < 2) return;

		// Skip if any selector contains & — nesting context, not a grouping candidate
		if (selectors.some((s) => s.includes("&"))) return;

		/** @type {Map<string, string[]>} prefix → [suffix, ...] */
		const groups = new Map();

		for (const selector of selectors) {
			const trimmed = selector.trim();
			const split = splitAtLastCombinator(trimmed);
			if (!split) continue; // single-token selector — skip

			const { prefix, suffix } = split;
			if (!groups.has(prefix)) groups.set(prefix, []);
			groups.get(prefix).push(suffix);
		}

		for (const [prefix, suffixes] of groups) {
			if (suffixes.length < 2) continue;

			result.warn(messages.rejected(prefix, suffixes), {
				node: ruleNode,
				ruleName,
				word: prefix,
			});
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
