// stylelint-plugin-pseudo-element-nesting.js
// Rule: pseudo-element selectors must be nested inside their parent rule.
//
// ✅ .card { &::after { } }
// ❌ .card::after { }   — must be nested in .card

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/pseudo-element-requires-nesting";

const messages = {
	rejected: (selector) =>
		`Pseudo-element in "${selector}" must be nested inside the parent rule.\n` +
		`  Fix: .parent { &::pseudo-element { } }`,
};

const meta = { url: "" };

const PSEUDO_ELEMENT_RE =
	/::(?:after|before|first-line|first-letter|placeholder|selection|marker|backdrop|cue|file-selector-button|grammar-error|highlight|part|slotted|spelling-error|target-text|view-transition[-\w]*)/i;

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

/**
 * True when the selector has a base part before the pseudo-element,
 * i.e. it's not a bare ::after but .something::after.
 * Excludes universal selector patterns like *::before.
 */
function hasPseudoElementWithBase(selector) {
	const match = PSEUDO_ELEMENT_RE.exec(selector);
	if (!match) return false;
	// There must be something before the ::
	if (match.index === 0) return false;
	// Exclude universal selector: *::before, *::after
	const base = selector.slice(0, match.index);
	if (base.trim() === "*") return false;
	return true;
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkRules((ruleNode) => {
		if (!isRootLevel(ruleNode)) return;

		const selectors = ruleNode.selectors ?? [ruleNode.selector];

		for (const selector of selectors) {
			if (hasPseudoElementWithBase(selector.trim())) {
				result.warn(messages.rejected(selector.trim()), {
					node: ruleNode,
					ruleName,
					word: "pseudo-element",
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
