// stylelint-plugin-no-root-tag-selector.js
// Rule: bare HTML tag selectors are forbidden at root level.
// Tags must be scoped inside a component class via nesting (&).
//
// ✅ .card { & h2 { } }
// ✅ .card h2 { }          ← scoped descendant (flat, not root)
// ✅ h2 { }                ← inside @layer base / @layer reset — allowed
// ❌ h2 { font-size: ... } ← root-level, global bleed
// ❌ p { color: ... }      ← root-level, global bleed
// ❌ input { }             ← root-level, use .field input or @layer base

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/no-root-tag-selector";

const messages = {
	rejected: (selector) =>
		`Bare tag selector "${selector}" at root level — scope inside a component class: ".component & ${selector}" or ".component ${selector}".`,
};

const meta = { url: "" };

// HTML tags that are commonly misused at root level in component files
const TAG_PATTERN =
	/^(a|abbr|address|article|aside|b|blockquote|br|button|caption|cite|code|col|colgroup|data|datalist|dd|del|details|dfn|dialog|div|dl|dt|em|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|i|iframe|img|input|ins|kbd|label|legend|li|main|mark|menu|meter|nav|ol|optgroup|option|output|p|picture|pre|progress|q|rp|rt|ruby|s|samp|section|select|small|source|span|strong|sub|summary|sup|table|tbody|td|textarea|tfoot|th|thead|time|tr|track|u|ul|var|video|wbr)$/;

// Selectors that are intentionally global (resets, base layer)
const ALLOWED_GLOBAL = /^\*|^:root|^html|^body/;

/**
 * Check if a node is inside @layer base or @layer reset —
 * tag selectors are intentional there.
 * @param {import('postcss').Node} node
 */
function isInsideBaseLayer(node) {
	let current = node.parent;
	while (current) {
		if (
			current.type === "atrule" &&
			current.name === "layer" &&
			/\b(base|reset|defaults?|global)\b/.test(current.params)
		) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

/**
 * A rule node is at "root level" when its parent is the Root node
 * or a top-level @layer / @media / @supports that is itself a direct child of Root.
 * Nested rules (inside another rule node) are scoped — allowed.
 * @param {import('postcss').Rule} ruleNode
 */
function isRootLevel(ruleNode) {
	const parent = ruleNode.parent;
	if (!parent) return false;
	// Direct child of Root → root level
	if (parent.type === "root") return true;
	// Child of atrule (media/supports/layer) that is itself root-level
	if (parent.type === "atrule" && parent.parent?.type === "root") return true;
	return false;
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkRules((ruleNode) => {
		if (!isRootLevel(ruleNode)) return;
		if (isInsideBaseLayer(ruleNode)) return;

		// Handle comma-separated selectors: "h2, p { }"
		const selectors = ruleNode.selectors ?? [ruleNode.selector];

		for (const selector of selectors) {
			const trimmed = selector.trim();

			// Allow explicit globals: *, :root, html, body
			if (ALLOWED_GLOBAL.test(trimmed)) continue;

			// Match pure tag — no class, no id, no attribute, no pseudo
			if (TAG_PATTERN.test(trimmed)) {
				result.warn(messages.rejected(trimmed), {
					node: ruleNode,
					ruleName,
					word: trimmed,
				});
				break; // one warning per rule node is enough
			}
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
