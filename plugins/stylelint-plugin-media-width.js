// stylelint-plugin-media-width.js
// Rule: @media (width ...) must be nested inside a selector rule, not at root level.
//
// ✅ .btn { @media (width <= 768px) { ... } }
// ❌ @media (width <= 768px) { .btn { ... } }   — flat, should be nested in .btn

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/media-width-requires-nesting";

const messages = {
	rejected: (params) =>
		`"@media (${params})" must be nested inside a selector rule, not at root level.\n` +
		`  Fix: .selector { @media (${params}) { ... } }`,
};

const meta = { url: "" };

const MEDIA_WIDTH_RE = /\bwidth\b/;

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkAtRules("media", (atRule) => {
		if (!MEDIA_WIDTH_RE.test(atRule.params)) return;
		if (atRule.parent?.type !== "rule") {
			result.warn(messages.rejected(atRule.params.trim()), {
				node: atRule,
				ruleName,
				word: "@media",
			});
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
