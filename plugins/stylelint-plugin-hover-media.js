// stylelint-plugin-hover-media.js
// Rule: :hover selectors must be inside @media (hover: hover) nested in the parent rule.
//
// ✅ .btn { @media (hover: hover) { &:hover { } } }
// ❌ .btn:hover { }                              — no media wrapper at all
// ❌ @media (hover: hover) { .btn:hover { } }   — media is flat, not nested in .btn

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/hover-requires-media";

const messages = {
	rejected: (selector) =>
		`":hover" must be inside a nested "@media (hover: hover)". Found: "${selector}"\n` +
		`  Fix: .selector { @media (hover: hover) { &:hover { } } }`,
};

const meta = { url: "" };

/** @param {import('postcss').Node} node */
function isInsideNestedHoverMedia(node) {
	let current = node.parent;
	while (current) {
		if (current.type === "atrule" && current.name === "media" && /\(\s*hover\s*:\s*hover\s*\)/.test(current.params)) {
			// @media must be nested inside a rule — @container at-rules between @media
			// and the parent rule are allowed (e.g. rule > @container > @media > &:hover).
			let ancestor = current.parent;
			while (ancestor) {
				if (ancestor.type === "rule") return true;
				if (ancestor.type === "root") return false;
				ancestor = ancestor.parent;
			}
			return false;
		}
		current = current.parent;
	}
	return false;
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkRules((ruleNode) => {
		const selector = ruleNode.selector ?? "";

		if (!/:hover/.test(selector)) return;

		if (!isInsideNestedHoverMedia(ruleNode)) {
			result.warn(messages.rejected(selector.trim()), {
				node: ruleNode,
				ruleName,
				word: ":hover",
			});
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
