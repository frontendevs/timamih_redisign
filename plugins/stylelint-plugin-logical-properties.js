// stylelint-plugin-logical-properties.js
// Rule: use logical properties for spacing/layout; physical properties are allowed
// only where they describe screen coordinates or physically fixed sizes.
//
// Logical (always required for spacing):
//   padding-inline, padding-block, margin-inline, margin-block
//   border-inline, border-block, inset-inline, inset-block
//   max-inline-size (for containers with margin-inline: auto)
//
// Physical — ALLOWED when:
//   A) same rule contains `position` (top/right/bottom/left describe screen coords)
//   B) same rule contains `width`/`height` on img, svg, video — media sizing
//   C) shorthand `padding`/`margin` with identical all-sides value — no directional intent
//
// ❌ padding-left: 24px         → padding-inline-start: 24px
// ❌ margin-top: 0              → margin-block-start: 0
// ❌ padding-right: var(--x)    → padding-inline-end: var(--x)
// ✅ padding-inline: 24px
// ✅ padding: 24px              — shorthand, same all sides
// ✅ .drawer { position: fixed; top: 0; right: 0 }   — screen coords, allowed
// ✅ img { width: 160px; height: auto }              — media sizing, allowed

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/logical-properties";

const REPLACEMENTS = {
	"padding-left": "padding-inline-start",
	"padding-right": "padding-inline-end",
	"padding-top": "padding-block-start",
	"padding-bottom": "padding-block-end",
	"margin-left": "margin-inline-start",
	"margin-right": "margin-inline-end",
	"margin-top": "margin-block-start",
	"margin-bottom": "margin-block-end",
	"border-left": "border-inline-start",
	"border-right": "border-inline-end",
	"border-top": "border-block-start",
	"border-bottom": "border-block-end",
	left: "inset-inline-start",
	right: "inset-inline-end",
	top: "inset-block-start",
	bottom: "inset-block-end",
	width: "inline-size",
	height: "block-size",
	"min-width": "min-inline-size",
	"max-width": "max-inline-size",
	"min-height": "min-block-size",
	"max-height": "max-block-size",
};

const PHYSICAL_PROPS = new Set(Object.keys(REPLACEMENTS));

// Physical inset props — allowed when `position` is present in the same rule
const INSET_PROPS = new Set(["top", "right", "bottom", "left"]);

// Physical size props — allowed when the rule is a media/icon sizing context
const SIZE_PROPS = new Set(["width", "height", "min-width", "max-width", "min-height", "max-height"]);

// Physical directional border props — allowed when used as visual dividers
// (border-top/bottom as separator lines rather than block-start/end)
const BORDER_PHYSICAL_PROPS = new Set(["border-top", "border-right", "border-bottom", "border-left"]);

const messages = {
	rejected: (prop, replacement) => `Use logical property "${replacement}" instead of physical "${prop}".`,
};

const meta = { url: "" };

/**
 * Collect all declared property names within a rule node (direct decls only,
 * not inside nested at-rules or nested rules).
 * @param {import('postcss').Rule} ruleNode
 * @returns {Set<string>}
 */
function getDeclaredProps(ruleNode) {
	const props = new Set();
	ruleNode.each((node) => {
		if (node.type === "decl") props.add(node.prop);
	});
	return props;
}

/**
 * True when the rule explicitly sets `position` — physical inset props
 * (top/right/bottom/left) are coordinate-system values here, not flow offsets.
 * @param {Set<string>} props
 */
function hasPosition(props) {
	return props.has("position");
}

/**
 * True when the rule looks like a media/icon sizing context:
 * contains `width` or `height` alongside `aspect-ratio`, `object-fit`,
 * or sits on an img/svg/video selector.
 * @param {Set<string>} props
 * @param {import('postcss').Rule} ruleNode
 */
function isMediaSizingContext(props, ruleNode) {
	if (props.has("aspect-ratio") || props.has("object-fit") || props.has("object-position")) return true;
	// Heuristic: selector ends with or equals a media tag
	const selector = ruleNode.selector ?? "";
	return /\b(img|svg|video|picture|canvas|iframe)\b/.test(selector);
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkDecls((decl) => {
		const prop = decl.prop;
		if (!PHYSICAL_PROPS.has(prop)) return;

		const ruleNode = decl.parent;
		if (!ruleNode || ruleNode.type !== "rule") return;

		const declaredProps = getDeclaredProps(ruleNode);

		// Inset props: allowed when position is present
		if (INSET_PROPS.has(prop) && hasPosition(declaredProps)) return;

		// Size props: allowed in media/icon sizing context
		if (SIZE_PROPS.has(prop) && isMediaSizingContext(declaredProps, ruleNode)) return;

		// Physical border props: allowed — they express visual top/bottom dividers,
		// not block-start/end in flow context; leave to author's judgment
		if (BORDER_PHYSICAL_PROPS.has(prop)) return;

		const replacement = REPLACEMENTS[prop];
		result.warn(messages.rejected(prop, replacement), {
			node: decl,
			ruleName,
			word: prop,
		});
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
