// stylelint-plugin-container.js
// Rule: @container must be nested inside a selector rule, not at root level.
//
// ✅ .btn { @container (width >= 768px) { ... } }
// ❌ @container (width >= 768px) { .btn { ... } }   — flat, should be nested in .btn

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/container-requires-nesting";

const messages = {
	rejected: (params) =>
		`"@container ${params}" must be nested inside a selector rule, not at root level.\n` +
		`  Fix: .selector { @container ${params} { ... } }`,
};

const meta = { url: "" };

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkAtRules("container", (atRule) => {
		if (atRule.parent?.type !== "rule") {
			result.warn(messages.rejected(atRule.params.trim()), {
				node: atRule,
				ruleName,
				word: "@container",
			});
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
