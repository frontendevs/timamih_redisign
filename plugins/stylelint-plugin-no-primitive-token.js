// stylelint-plugin-no-primitive-token.js
// Rule: components use semantic tokens, never primitives.
// Primitive token references (var(--brand-500), var(--neutral-700), var(--white)…)
// are allowed ONLY in the token contract file (tokens.css),
// where the semantic layer derives from them. Everywhere else → forbidden.
//
// Primitives (forbidden outside tokens):
//   --white, --black
//   --brand-*, --neutral-*, --surface-*, --alt-*   (numbered scale)
//   --error-N, --success-N, --warning-N, --info-N  (NUMBERED status = primitive)
//
// Semantic (always allowed): --error, --error-bg, --accent, --bg, --text … (no numeric suffix)
//
// ✅ tokens.css:  --accent: light-dark(var(--brand-500), var(--brand-400))
// ✅ button.css:  color: var(--accent);  border: 1px solid var(--border-muted)
// ✅ badge.css:   background: oklch(from var(--accent-muted) l c h / 0.6)
// ❌ badge.css:   color: var(--alt-700)        ← primitive in component
// ❌ button.css:  --btn-bg: var(--neutral-100) ← primitive into component prop

import stylelint from "stylelint";

const { createPlugin } = stylelint;

const ruleName = "local/no-primitive-token";

const messages = {
	rejected: (token) => `Primitive token "${token}" referenced outside tokens.css — use a semantic token instead.`,
};

const meta = { url: "" };

// Files where primitives legitimately live (the value contract).
const TOKEN_FILES = /tokens\.css$/;

// Primitive token names: numbered scales + bare white/black.
const PRIMITIVE_RE = /^--(?:(?:brand|neutral|surface|alt|error|success|warning|info)-\d+|white|black)$/;

// Extract every var(--name) reference from a declaration value.
const VAR_REF_RE = /var\(\s*(--[a-zA-Z0-9-]+)/g;

const rule = (primary) => (root, result) => {
	if (primary !== true) return;

	const file = (root.source && root.source.input && root.source.input.file) || "";
	if (TOKEN_FILES.test(file)) return; // primitives belong here

	root.walkDecls((decl) => {
		for (let match; (match = VAR_REF_RE.exec(decl.value)) !== null; ) {
			const token = match[1];
			if (!PRIMITIVE_RE.test(token)) continue;

			result.warn(messages.rejected(token), {
				node: decl,
				ruleName,
				word: token,
			});
		}
	});
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
