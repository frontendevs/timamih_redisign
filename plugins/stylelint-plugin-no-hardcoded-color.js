// stylelint-plugin-no-hardcoded-color.js
// Rule: color values must use CSS custom properties (var(--*)) or oklch().
// Hardcoded hex, rgb(), hsl() are forbidden everywhere including :root and @layer reset.
//
// Exception (always allowed):
//   - custom property declarations: --card-bg: oklch(...)  ← prop starts with --
//
// ✅ color: var(--text-primary)
// ✅ color: oklch(0.5 0.2 270)
// ✅ background-color: oklch(from var(--brand-500) l c h / 0.08)
// ✅ background-color: oklch(from var(--brand-500) calc(l * 0.9) c h)
// ✅ :root { --brand-500: oklch(0.5 0.2 270) }   ← custom property declaration
// ✅ .card { --card-bg: oklch(0.5 0.2 270) }     ← custom property declaration
// ❌ :root { --brand-500: #ffffff }              ← hex forbidden even in :root
// ❌ @layer reset { * { color: #000 } }          ← hex forbidden in reset too
// ❌ color: #1a1a1a
// ❌ background-color: rgb(255 0 0)
// ❌ border-color: hsl(200 50% 50%)

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/no-hardcoded-color";

const messages = {
	rejected: (prop, value) => `Hardcoded color in "${prop}: ${value}" — use var(--token) or oklch().`,
};

const meta = { url: "" };

// Properties that carry color values
const COLOR_PROPS =
	/^(color|background-color|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color|border-block-color|border-inline-color|border-block-start-color|border-block-end-color|border-inline-start-color|border-inline-end-color|outline-color|text-decoration-color|column-rule-color|caret-color|accent-color|fill|stroke|stop-color|flood-color|lighting-color|box-shadow|text-shadow)$/;

// Hardcoded color patterns — oklch() is intentionally excluded (always allowed)
const HARDCODED_HEX = /#[0-9a-fA-F]{3,8}\b/;
const HARDCODED_RGB = /\brgb\s*\(/;
const HARDCODED_HSL = /\bhsl\s*\(/;
// lch must not match inside oklch — use negative lookbehind
const HARDCODED_LAB = /\blab\s*\(|(?<!ok)lch\s*\(|oklab\s*\(/;

/**
 * Remove all oklch(...) calls that use relative color syntax:
 *   oklch(from var(--x) l c h / 0.5)
 *   oklch(from var(--x) calc(l * 0.9) c h)
 *
 * Uses bracket-counting so nested parens (e.g. calc()) are handled correctly.
 * @param {string} value
 * @returns {string}
 */
function stripRelativeOklch(value) {
	const OPEN_RE = /oklch\s*\(\s*from\s+var\s*\(/g;
	let result = "";
	let lastIndex = 0;

	for (let match; (match = OPEN_RE.exec(value)) !== null; ) {
		// Find the opening paren of oklch( — walk back from 'from'
		// match.index points to 'o' of oklch; find its '('
		const oklchStart = match.index;

		// Find position of the outer opening paren of oklch
		const outerParen = value.indexOf("(", oklchStart);
		if (outerParen === -1) break;

		// Count brackets from outerParen to find the matching closing paren
		let depth = 0;
		let i = outerParen;
		for (; i < value.length; i++) {
			if (value[i] === "(") depth++;
			else if (value[i] === ")") {
				depth--;
				if (depth === 0) break;
			}
		}

		// Append everything before this oklch call, skip the call itself
		result += value.slice(lastIndex, oklchStart);
		lastIndex = i + 1; // after closing paren
		OPEN_RE.lastIndex = lastIndex;
	}

	result += value.slice(lastIndex);
	return result;
}

/** @param {string} value */
function hasHardcodedColor(value) {
	const stripped = stripRelativeOklch(value);
	return (
		HARDCODED_HEX.test(stripped) ||
		HARDCODED_RGB.test(stripped) ||
		HARDCODED_HSL.test(stripped) ||
		HARDCODED_LAB.test(stripped)
	);
}

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	root.walkDecls((decl) => {
		// custom property declaration (--card-bg: oklch(...)) — always allowed
		if (decl.prop.startsWith("--")) return;
		if (!COLOR_PROPS.test(decl.prop)) return;
		if (!hasHardcodedColor(decl.value)) return;

		result.warn(messages.rejected(decl.prop, decl.value), {
			node: decl,
			ruleName,
			word: decl.value,
		});
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
