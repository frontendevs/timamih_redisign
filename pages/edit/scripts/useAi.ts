/**
 * useAi.ts
 * Multi-provider AI integration for the inline editor.
 * Supports Anthropic (Haiku), OpenAI (GPT nano), Google (Gemini Flash Lite).
 * Each provider is a small/fast model suitable for content editing tasks.
 */

const SYSTEM_PROMPT = `You are a content editor for a marketing/media agency website.
You will receive a list of editable text fields from the current page and an instruction to modify the content.

Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences:
{"fields": [{"editId": "field.id", "text": "new plain text"}]}

Rules:
- Include ONLY fields that need to change.
- "text" must be plain text only — no HTML tags.
- Keep the original language unless explicitly asked to translate.
- If nothing needs to change, return {"fields": []}`;

export interface AiModel {
	id: string;
	label: string;
	desc: string;
}

export interface FieldEdit {
	editId: string;
	text: string;
}

export interface AiResult {
	fields: FieldEdit[];
}

export const MODELS: AiModel[] = [
	{ id: "haiku", label: "Haiku", desc: "Claude · Anthropic" },
	{ id: "nano", label: "GPT nano", desc: "OpenAI · GPT-4.1" },
	{ id: "flash-lite", label: "Flash Lite", desc: "Gemini · Google" },
];

/** Parse data-edit-id fields from raw HTML source. */
export function extractFields(html: string): Record<string, string> {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const result: Record<string, string> = {};
	for (const el of doc.querySelectorAll<HTMLElement>("[data-edit-id]")) {
		const id = el.getAttribute("data-edit-id");
		if (id) result[id] = (el.textContent ?? "").trim();
	}
	return result;
}

function buildMessage(fields: Record<string, string>, instruction: string): string {
	const list = Object.entries(fields)
		.map(([id, text]) => `${id}: "${text}"`)
		.join("\n");
	return `Current editable fields:\n${list}\n\nInstruction: ${instruction}`;
}

function parseJson(raw: string, provider: string): AiResult {
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) throw new Error(`Could not parse ${provider} response: ${raw}`);
	return JSON.parse(match[0]) as AiResult;
}

// ── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic(fields: Record<string, string>, instruction: string): Promise<AiResult> {
	const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY not set in .env");

	const resp = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1024,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: buildMessage(fields, instruction) }],
		}),
	});

	if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);

	const data = (await resp.json()) as { content: Array<{ type: string; text: string }> };
	const block = data.content.find((b) => b.type === "text");
	if (!block) throw new Error("Anthropic returned no text block");
	return parseJson(block.text, "Anthropic");
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(fields: Record<string, string>, instruction: string): Promise<AiResult> {
	const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
	if (!apiKey) throw new Error("VITE_OPENAI_API_KEY not set in .env");

	const resp = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-4.1-nano",
			max_tokens: 1024,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: buildMessage(fields, instruction) },
			],
		}),
	});

	if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);

	const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
	const text = data.choices[0]?.message.content ?? "";
	return parseJson(text, "OpenAI");
}

// ── Google ───────────────────────────────────────────────────────────────────

async function callGoogle(fields: Record<string, string>, instruction: string): Promise<AiResult> {
	const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY;
	if (!apiKey) throw new Error("VITE_GOOGLE_AI_KEY not set in .env");

	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

	const resp = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
			contents: [{ role: "user", parts: [{ text: buildMessage(fields, instruction) }] }],
			generationConfig: { maxOutputTokens: 1024 },
		}),
	});

	if (!resp.ok) throw new Error(`Google AI ${resp.status}: ${await resp.text()}`);

	const data = (await resp.json()) as {
		candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
	};
	const text = data.candidates[0]?.content.parts[0]?.text ?? "";
	return parseJson(text, "Google");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function callAi(fields: Record<string, string>, instruction: string, modelId: string): Promise<AiResult> {
	switch (modelId) {
		case "haiku":
			return callAnthropic(fields, instruction);
		case "nano":
			return callOpenAI(fields, instruction);
		case "flash-lite":
			return callGoogle(fields, instruction);
		default:
			throw new Error(`Unknown model: ${modelId}`);
	}
}
