// stylelint-plugin-border-width.js
// Rule: border-width values must be >= 1.5px
//
// ✅ border: 1.5px solid var(--color)
// ✅ border-width: 2px
// ✅ border-block-end: 1.5px solid transparent
// ❌ border: 1px solid var(--color)
// ❌ border-width: 1px
// ❌ border-top: 1px solid red

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/border-width-min";

const messages = {
	rejected: (value) => `Border width must be >= 1.5px. Found: "${value}"`,
};

const meta = { url: "" };

const BORDER_PROPS = /^border(-block(-start|-end)?|-inline(-start|-end)?|-top|-right|-bottom|-left)?(-width)?$/;

/** @param {string} value */
function extractPxValues(value) {
	const matches = value.match(/[\d.]+px/g);
	return matches ? matches.map(parseFloat) : [];
}

/** @param {string} prop @param {string} value */
function isBorderWidthViolation(prop, value) {
	if (!BORDER_PROPS.test(prop)) return false;

	const pxValues = extractPxValues(value);
	if (pxValues.length === 0) return false;

	return pxValues.some((v) => v < 1.5);
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkDecls((decl) => {
		if (isBorderWidthViolation(decl.prop, decl.value)) {
			result.warn(messages.rejected(decl.value), {
				node: decl,
				ruleName,
				word: decl.value,
			});
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
