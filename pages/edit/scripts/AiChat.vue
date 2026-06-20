<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { esc } from "../../shared/utils/escapeHtml.ts";
import { type Locale } from "../../shared/utils/locale.ts";
import { type GhConfig, type GhRepo, clearConfig, fetchBranches, fetchUserRepos, readSource, saveConfig, writeField } from "./ghSource.ts";
import { MODELS, callAi, extractFields } from "./useAi.ts";

interface Message {
	role: "user" | "assistant" | "error" | "loading";
	text: string;
}

const props = defineProps<{
	config: GhConfig | null;
	locale: Locale;
	frameEl: HTMLIFrameElement | null;
}>();

const emit = defineEmits<{
	status: [msg: string, kind: "info" | "error"];
	connect: [config: GhConfig];
	disconnect: [];
}>();

// ── Setup form ────────────────────────────────────────────────────────────────

const oauthToken = ref<string | null>(null);
const setupRepos = ref<GhRepo[]>([]);
const setupSelectedRepo = ref("");
const setupBranches = ref<string[]>([]);
const setupSelectedBranch = ref("main");
const setupReposLoading = ref(false);
const setupBranchesLoading = ref(false);
const setupError = ref("");

function signIn(): void {
	const state = crypto.randomUUID();
	sessionStorage.setItem("gh_oauth_state", state);
	const params = new URLSearchParams({
		client_id: import.meta.env.VITE_GH_CLIENT_ID,
		scope: "repo",
		redirect_uri: `${import.meta.env.VITE_GH_OAUTH_WORKER}/callback`,
		state,
	});
	window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

async function loadRepos(token: string): Promise<void> {
	setupError.value = "";
	setupReposLoading.value = true;
	setupRepos.value = [];
	setupBranches.value = [];
	try {
		setupRepos.value = await fetchUserRepos(token);
		if (setupRepos.value.length > 0) {
			setupSelectedRepo.value = setupRepos.value[0]!.full_name;
			await loadBranches(token, setupSelectedRepo.value);
		}
	} catch (e) {
		setupError.value = e instanceof Error ? e.message : String(e);
	} finally {
		setupReposLoading.value = false;
	}
}

async function loadBranches(token: string, fullName: string): Promise<void> {
	if (!fullName) return;
	const [owner, repo] = fullName.split("/") as [string, string];
	setupBranchesLoading.value = true;
	setupBranches.value = [];
	try {
		const list = await fetchBranches(token, owner, repo);
		setupBranches.value = list;
		const defaultBranch = setupRepos.value.find((r) => r.full_name === fullName)?.default_branch ?? "main";
		setupSelectedBranch.value = list.includes(defaultBranch) ? defaultBranch : (list[0] ?? "main");
	} catch (e) {
		setupError.value = e instanceof Error ? e.message : String(e);
	} finally {
		setupBranchesLoading.value = false;
	}
}

async function onRepoChange(): Promise<void> {
	const token = oauthToken.value;
	if (!token) return;
	setupBranches.value = [];
	setupError.value = "";
	await loadBranches(token, setupSelectedRepo.value);
}

function connect(): void {
	const token = oauthToken.value;
	const fullName = setupSelectedRepo.value;
	const branch = setupSelectedBranch.value || "main";
	if (!token || !fullName) return;
	const [owner, repo] = fullName.split("/") as [string, string];
	const newCfg: GhConfig = { token, owner: owner!, repo: repo!, branch };
	saveConfig(newCfg);
	emit("connect", newCfg);
}

function disconnectGh(): void {
	clearConfig();
	oauthToken.value = null;
	setupRepos.value = [];
	setupBranches.value = [];
	setupError.value = "";
	emit("disconnect");
}

// ── Chat ──────────────────────────────────────────────────────────────────────

const messages = ref<Message[]>([]);
const prompt = ref("");
const loading = ref(false);
const model = ref(MODELS[0]?.id ?? "haiku");
const modelPickerOpen = ref(false);
const msgList = ref<HTMLElement>();
const inputEl = ref<HTMLTextAreaElement>();
const inputWrap = ref<HTMLElement>();

const currentModel = computed(() => MODELS.find((m) => m.id === model.value) ?? MODELS[0]);

function toggleModelPicker(e: Event): void {
	e.stopPropagation();
	modelPickerOpen.value = !modelPickerOpen.value;
}

function selectModel(id: string): void {
	model.value = id;
	modelPickerOpen.value = false;
}

function closeOnOutsideClick(e: MouseEvent): void {
	if (modelPickerOpen.value && !inputWrap.value?.contains(e.target as Node)) {
		modelPickerOpen.value = false;
	}
}

onMounted(() => {
	document.addEventListener("click", closeOnOutsideClick);

	// Pick up OAuth token from URL hash after GitHub redirect
	const hash = new URLSearchParams(location.hash.slice(1));
	const token = hash.get("gh_token");
	const state = hash.get("state");
	if (token) {
		history.replaceState(null, "", location.pathname + location.search);
		if (state && state === sessionStorage.getItem("gh_oauth_state")) {
			sessionStorage.removeItem("gh_oauth_state");
			oauthToken.value = token;
			void loadRepos(token);
		} else {
			setupError.value = "OAuth state mismatch — possible CSRF. Try signing in again.";
		}
	}
});
onBeforeUnmount(() => document.removeEventListener("click", closeOnOutsideClick));

watch(
	() => messages.value.length,
	async () => {
		await nextTick();
		if (msgList.value) msgList.value.scrollTop = msgList.value.scrollHeight;
	},
);

function autoResize(el: HTMLTextAreaElement): void {
	el.style.height = "auto";
	el.style.height = `${el.scrollHeight}px`;
}

function onInput(e: Event): void {
	prompt.value = (e.target as HTMLTextAreaElement).value;
	autoResize(e.target as HTMLTextAreaElement);
}

async function send(): Promise<void> {
	const instruction = prompt.value.trim();
	if (!instruction || loading.value) return;

	const currentCfg = props.config;
	if (!currentCfg) return;

	prompt.value = "";
	if (inputEl.value) inputEl.value.style.height = "auto";
	messages.value.push({ role: "user", text: instruction });
	messages.value.push({ role: "loading", text: "" });
	loading.value = true;

	try {
		const html = await readSource(currentCfg, props.locale);
		const fields = extractFields(html);

		if (Object.keys(fields).length === 0) {
			messages.value.pop();
			messages.value.push({ role: "assistant", text: "No editable fields found on this page." });
			return;
		}

		const result = await callAi(fields, instruction, model.value);
		messages.value.pop();

		if (result.fields.length === 0) {
			messages.value.push({ role: "assistant", text: "No changes needed." });
			return;
		}

		for (const { editId, text } of result.fields) {
			await writeField(currentCfg, props.locale, editId, esc(text));
		}

		const lines = result.fields.map((f) => `• ${f.editId}: "${f.text}"`);
		messages.value.push({
			role: "assistant",
			text: `Applied ${result.fields.length} change(s):\n${lines.join("\n")}`,
		});

		emit("status", `AI applied ${result.fields.length} change(s)`, "info");

		const el = props.frameEl;
		if (el) {
			const src = el.src;
			el.src = "";
			requestAnimationFrame(() => { el.src = src; });
		}
	} catch (e) {
		messages.value.pop();
		const msg = e instanceof Error ? e.message : String(e);
		messages.value.push({ role: "error", text: msg });
		emit("status", `AI error: ${msg}`, "error");
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<aside class="ed-chat">
		<!-- Message list -->
		<div ref="msgList" class="ed-messages">
			<div v-if="messages.length === 0" class="ed-empty">
				<!-- Setup form -->
				<template v-if="!config">
					<!-- Sign in -->
					<template v-if="!oauthToken && !setupReposLoading">
						<p class="ed-setup-title">Connect to GitHub</p>
						<button type="button" class="ed-gh-signin" @click="signIn">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
							</svg>
							Sign in with GitHub
						</button>
						<p v-if="setupError" class="ed-setup-error">{{ setupError }}</p>
					</template>

					<!-- Loading repos after OAuth -->
					<template v-else-if="setupReposLoading">
						<span class="ed-setup-spinner ed-setup-spinner--lg" aria-label="Loading repositories" />
						<p class="ed-setup-loading-text">Loading repositories…</p>
					</template>

					<!-- Repo + branch picker -->
					<template v-else-if="oauthToken && setupRepos.length > 0">
						<p class="ed-setup-title">Choose a repository</p>
						<form class="ed-setup-form" @submit.prevent="connect">
							<label class="ed-setup-label">
								Repository
								<select
									v-model="setupSelectedRepo"
									class="ed-setup-input ed-setup-select"
									@change="onRepoChange"
								>
									<option v-for="r in setupRepos" :key="r.full_name" :value="r.full_name">
										{{ r.full_name }}
									</option>
								</select>
							</label>
							<label v-if="setupBranches.length > 0" class="ed-setup-label">
								Branch
								<select v-model="setupSelectedBranch" class="ed-setup-input ed-setup-select">
									<option v-for="b in setupBranches" :key="b" :value="b">{{ b }}</option>
								</select>
							</label>
							<div v-else-if="setupBranchesLoading" class="ed-setup-branches-loading">
								<span class="ed-setup-spinner" aria-label="Loading branches" />
								Loading branches…
							</div>
							<p v-if="setupError" class="ed-setup-error">{{ setupError }}</p>
							<button
								type="submit"
								class="ed-open-btn"
								:disabled="!setupSelectedRepo || !setupSelectedBranch"
							>
								Connect
							</button>
						</form>
					</template>
				</template>

				<!-- Ready state -->
				<template v-else>
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="ed-empty-icon">
						<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".2" />
						<path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".4" />
					</svg>
					<p>Describe what to change and AI will edit the content.</p>
					<p class="ed-empty-hint">Enter to send · Shift+Enter new line</p>
					<button type="button" class="ed-disconnect" @click="disconnectGh">Disconnect</button>
				</template>
			</div>

			<template v-for="(msg, i) in messages" :key="i">
				<div v-if="msg.role === 'user'" class="ed-msg ed-msg--user">
					<p class="ed-bubble">{{ msg.text }}</p>
				</div>
				<div v-else-if="msg.role === 'assistant'" class="ed-msg ed-msg--ai">
					<div class="ed-ai-avatar" aria-hidden="true">AI</div>
					<pre class="ed-ai-text">{{ msg.text }}</pre>
				</div>
				<div v-else-if="msg.role === 'loading'" class="ed-msg ed-msg--ai">
					<div class="ed-ai-avatar" aria-hidden="true">AI</div>
					<div class="ed-dots" aria-label="Thinking">
						<span class="ed-dot" />
						<span class="ed-dot" />
						<span class="ed-dot" />
					</div>
				</div>
				<div v-else-if="msg.role === 'error'" class="ed-msg ed-msg--error">
					<p class="ed-error-text">{{ msg.text }}</p>
				</div>
			</template>
		</div>

		<!-- Composer (only when connected) -->
		<div v-if="config" class="ed-composer" :class="{ 'is-disabled': loading }">
			<div ref="inputWrap" class="ed-input-wrap">
				<Transition name="ed-picker">
					<div v-if="modelPickerOpen" class="ed-model-popover">
						<button
							v-for="m in MODELS"
							:key="m.id"
							type="button"
							class="ed-model-option"
							:data-current="model === m.id ? 'true' : undefined"
							@click="selectModel(m.id)"
						>
							<svg class="ed-model-check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" :style="{ opacity: model === m.id ? 1 : 0 }">
								<path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
							<span class="ed-model-info">
								<span class="ed-model-name">{{ m.label }}</span>
								<span class="ed-model-desc">{{ m.desc }}</span>
							</span>
						</button>
					</div>
				</Transition>

				<textarea
					ref="inputEl"
					class="ed-compose-input"
					:value="prompt"
					placeholder="Describe what to change…"
					rows="1"
					:disabled="loading"
					@input="onInput"
					@keydown.enter.exact.prevent="send"
				/>
				<div class="ed-input-actions">
					<button
						type="button"
						class="ed-model-trigger"
						:disabled="loading"
						aria-label="Select model"
						:aria-expanded="modelPickerOpen"
						@click="toggleModelPicker"
					>
						{{ currentModel?.label ?? "Model" }}
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
					<button
						type="button"
						class="ed-compose-send"
						:disabled="loading || !prompt.trim()"
						aria-label="Send"
						@click="send"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path d="M12 20V4m0 0l-6 6m6-6l6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</aside>
</template>

<style>
	.ed-chat {
		display: grid;
		grid-template-rows: 1fr auto;
		overflow: hidden;
		background-color: var(--bg);
		border-inline-end: 1px solid var(--border);
		color: var(--text);
		container-type: inline-size;
		container-name: ed-chat;
	}

	/* ── Message list ─────────────────────────────────── */

	.ed-messages {
		overflow-y: auto;
		padding: var(--space-24) var(--space-16) var(--space-12);
		display: flex;
		flex-direction: column;
		gap: var(--space-20);
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
		max-inline-size: 960px;
		inline-size: 100%;
		margin-inline: auto;
	}

	.ed-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-10);
		margin-block-start: auto;
		margin-block-end: auto;
		padding: var(--space-40) var(--space-24);
		text-align: center;
	}

	.ed-empty-icon {
		color: var(--text-subtle);
	}

	.ed-empty p {
		margin: 0;
		font-size: var(--font-14);
		line-height: var(--lh-150);
		color: var(--text-muted);
	}

	.ed-empty-hint {
		font-size: var(--font-12) !important;
		color: var(--border-strong) !important;
	}

	/* ── Setup form ───────────────────────────────────── */

	.ed-setup-title {
		font-size: var(--font-16);
		font-weight: var(--fw-600);
		color: var(--text) !important;
		margin-block-end: var(--space-4);
	}

	.ed-setup-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-10);
		inline-size: 100%;
		max-inline-size: 320px;
		text-align: start;
	}

	.ed-setup-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		font-size: var(--font-12);
		color: var(--text-muted);
	}

	.ed-setup-input {
		padding: var(--space-8) var(--space-12);
		border: 1px solid var(--border);
		border-radius: var(--radius-8);
		background-color: var(--bg-input);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--font-14);
		outline: none;
		transition: border-color var(--transition-fast);
	}

	.ed-setup-input:focus {
		border-color: var(--accent);
	}

	.ed-gh-signin {
		display: flex;
		align-items: center;
		gap: var(--space-8);
		padding: var(--space-10) var(--space-20);
		border: 1px solid var(--border);
		border-radius: var(--radius-round);
		background-color: var(--bg-elevated);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--font-14);
		font-weight: var(--fw-500);
		cursor: pointer;
		transition: border-color var(--transition-fast), background-color var(--transition-fast);
	}

	.ed-gh-signin:hover {
		border-color: var(--accent);
		background-color: var(--bg-muted);
	}

	.ed-setup-select {
		appearance: auto;
		cursor: pointer;
	}

	.ed-setup-branches-loading {
		display: flex;
		align-items: center;
		gap: var(--space-8);
		font-size: var(--font-12);
		color: var(--text-muted);
	}

	.ed-setup-spinner {
		display: inline-block;
		inline-size: 12px;
		block-size: 12px;
		border: 2px solid var(--border);
		border-block-start-color: var(--accent);
		border-radius: var(--radius-round);
		animation: ed-spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	.ed-setup-spinner--lg {
		inline-size: 28px;
		block-size: 28px;
		border-width: 3px;
	}

	.ed-setup-loading-text {
		font-size: var(--font-13) !important;
		color: var(--text-muted) !important;
	}

	@keyframes ed-spin {
		to { transform: rotate(360deg); }
	}

	.ed-setup-error {
		font-size: var(--font-12) !important;
		color: var(--error-text) !important;
	}

	.ed-disconnect {
		margin-block-start: var(--space-4);
		padding: 0;
		border: none;
		background-color: transparent;
		color: var(--text-subtle);
		font-family: var(--font-body);
		font-size: var(--font-12);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color var(--transition-fast);
	}

	.ed-disconnect:hover {
		color: var(--error-text);
	}

	.ed-open-btn {
		margin-block-start: var(--space-4);
		padding: var(--space-8) var(--space-20);
		border: 1px solid var(--accent);
		border-radius: var(--radius-round);
		background-color: var(--accent);
		color: var(--accent-text);
		font-family: var(--font-body);
		font-size: var(--font-14);
		font-weight: var(--fw-500);
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.ed-open-btn:hover {
		opacity: 0.85;
	}

	/* ── Messages ─────────────────────────────────────── */

	.ed-msg {
		display: flex;
		gap: var(--space-10);
		align-items: flex-start;
	}

	.ed-msg--user {
		justify-content: flex-end;
	}

	.ed-bubble {
		margin: 0;
		padding: var(--space-10) var(--space-14);
		background-color: var(--bg-elevated);
		border-radius: var(--radius-18) var(--radius-18) var(--radius-4) var(--radius-18);
		font-size: var(--font-14);
		line-height: var(--lh-150);
		color: var(--text);
		max-inline-size: 82%;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.ed-ai-avatar {
		flex-shrink: 0;
		margin-block-start: var(--space-2);
		inline-size: var(--space-22);
		block-size: var(--space-22);
		border-radius: var(--radius-round);
		background-color: var(--info-600);
		color: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--font-10);
		font-weight: var(--fw-700);
		letter-spacing: var(--ls-wide);
	}

	.ed-ai-text {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--font-14);
		line-height: var(--lh-160);
		color: var(--text-muted);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.ed-dots {
		display: flex;
		gap: var(--space-6);
		align-items: center;
		padding-block-start: var(--space-6);
	}

	.ed-dot {
		display: block;
		inline-size: 7px;
		block-size: 7px;
		border-radius: var(--radius-round);
		background-color: var(--text-subtle);
		animation: ed-pulse 1.4s ease-in-out infinite;
	}

	.ed-dot:nth-child(2) { animation-delay: 0.2s; }
	.ed-dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes ed-pulse {
		0%, 100% { opacity: 0.25; transform: scale(0.85); }
		50% { opacity: 1; transform: scale(1); }
	}

	.ed-msg--error {
		padding: var(--space-8) var(--space-12);
		background-color: var(--error-bg);
		border-radius: var(--radius-8);
		border-inline-start: 2px solid var(--error-border);
	}

	.ed-error-text {
		margin: 0;
		font-size: var(--font-13);
		line-height: var(--lh-150);
		color: var(--error-text);
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* ── Composer ─────────────────────────────────────── */

	.ed-composer {
		padding: var(--space-12) var(--space-16) var(--space-16);
		border-block-start: 1px solid var(--border);
		background-color: var(--bg);
		max-inline-size: 960px;
		inline-size: 100%;
		margin-inline: auto;
	}

	.ed-composer.is-disabled {
		opacity: 0.5;
	}

	.ed-input-wrap {
		position: relative;
		display: grid;
		grid-template-rows: auto auto;
		padding: var(--space-10) var(--space-8) var(--space-8) var(--space-14);
		gap: var(--space-6);
		border: 1px solid var(--border);
		border-radius: var(--radius-20);
		background-color: var(--bg-input);
	}

	.ed-compose-input {
		inline-size: 100%;
		min-block-size: 24px;
		max-block-size: 120px;
		border: none;
		background-color: transparent;
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--font-14);
		line-height: var(--lh-150);
		resize: none;
		overflow-y: auto;
		outline: none;
	}

	.ed-compose-input:focus,
	.ed-compose-input:focus-visible {
		outline: none;
	}

	.ed-compose-input::placeholder {
		color: var(--text-subtle);
	}

	.ed-input-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-6);
	}

	.ed-model-trigger {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		block-size: var(--space-32);
		padding-inline: var(--space-10);
		border: 1px solid var(--border);
		border-radius: var(--radius-round);
		background-color: transparent;
		color: var(--text-muted);
		font-family: var(--font-body);
		font-size: var(--font-12);
		line-height: 1;
		cursor: pointer;
		transition: border-color var(--transition-fast), color var(--transition-fast);
	}

	.ed-model-trigger:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.ed-compose-send {
		flex-shrink: 0;
		inline-size: var(--space-32);
		block-size: var(--space-32);
		border-radius: var(--radius-round);
		border: none;
		background-color: var(--accent);
		color: var(--accent-text);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color var(--transition-fast), opacity var(--transition-fast);
	}

	.ed-compose-send:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.ed-compose-send:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	/* ── Model picker ─────────────────────────────────── */

	.ed-model-popover {
		position: absolute;
		inset-block-end: calc(100% + var(--space-8));
		inset-inline-start: 0;
		inline-size: 100%;
		padding: var(--space-6);
		border: 1px solid var(--border);
		border-radius: var(--radius-16);
		background-color: var(--bg-elevated);
		box-shadow: var(--shadow-lg);
		color: var(--text);
		z-index: 10;
	}

	.ed-picker-enter-active,
	.ed-picker-leave-active {
		transition: opacity var(--transition-fast), transform var(--transition-fast);
	}

	.ed-picker-enter-from,
	.ed-picker-leave-to {
		opacity: 0;
		transform: translateY(6px);
	}

	.ed-model-option {
		display: flex;
		align-items: center;
		gap: var(--space-10);
		inline-size: 100%;
		padding: var(--space-10) var(--space-12);
		border: none;
		border-radius: var(--radius-10);
		background-color: transparent;
		color: var(--text);
		font-family: var(--font-body);
		text-align: start;
		cursor: pointer;
		transition: background-color var(--transition-fast);
	}

	.ed-model-option:hover {
		background-color: var(--bg-muted);
	}

	.ed-model-option[data-current="true"] {
		color: var(--accent);
	}

	.ed-model-check {
		flex-shrink: 0;
		color: var(--accent);
		transition: opacity var(--transition-fast);
	}

	.ed-model-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.ed-model-name {
		font-size: var(--font-14);
		font-weight: var(--fw-500);
		line-height: var(--lh-130);
	}

	.ed-model-desc {
		font-size: var(--font-12);
		color: var(--text-muted);
		line-height: var(--lh-130);
	}
</style>
