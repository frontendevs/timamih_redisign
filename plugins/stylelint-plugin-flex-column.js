// stylelint-plugin-flex-column.js
// Rule: display:flex + flex-direction:column must be replaced with display:grid
//
// ✅ display: grid
// ❌ display: flex; flex-direction: column  →  auto-fix: display: grid (removes flex-direction)

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/no-flex-column";

const messages = {
	rejected: 'Use "display: grid" instead of "display: flex" + "flex-direction: column"',
};

const meta = { url: "", fixable: true };

const rule = (primary, _, context) => (root, result) => {
	if (primary !== true) return;

	root.walkDecls("display", (displayDecl) => {
		if (displayDecl.value !== "flex") return;

		// Find flex-direction: column as a direct sibling in the same block
		let directionDecl = null;
		displayDecl.parent?.each((node) => {
			if (node.type === "decl" && node.prop === "flex-direction" && node.value === "column") {
				directionDecl = node;
			}
		});

		if (!directionDecl) return;

		if (context.fix) {
			displayDecl.value = "grid";
			directionDecl.remove();
			return;
		}

		result.warn(messages.rejected, {
			node: displayDecl,
			ruleName,
			word: "flex",
		});
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
