<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { initArrayEditor } from "../../shared/ui/arrayEditor.ts";
import { initInlineEditor } from "../../shared/ui/inlineEditor.ts";
import { esc } from "../../shared/utils/escapeHtml.ts";
import { type Locale } from "../../shared/utils/locale.ts";
import AiChat from "./AiChat.vue";
import { type GhConfig, loadConfig, writeArray, writeAttr, writeField } from "./ghSource.ts";

const MIN_CHAT_WIDTH = 320;
const MIN_FRAME_WIDTH = 320;
const HANDLE_WIDTH = 4;
const CHAT_WIDTH_KEY = "ed-chat-width";

const cfg = shallowRef<GhConfig | null>(loadConfig());
const locale = ref<Locale>("en");
const frame = ref<HTMLIFrameElement>();
const chatWidth = ref(Number(localStorage.getItem(CHAT_WIDTH_KEY)) || 640);
const isResizing = ref(false);
let teardown: (() => void) | null = null;

const BASE = import.meta.env.BASE_URL;
const BASE_PREFIX = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;

function localePath(loc: Locale): string {
	return loc === "en" ? `${BASE}index.html` : `${BASE}${loc}/index.html`;
}

function detectLocale(pathname: string): Locale {
	const rel = BASE.length > 1 && pathname.startsWith(BASE_PREFIX) ? pathname.slice(BASE_PREFIX.length) : pathname;
	if (rel.startsWith("/ru")) return "ru";
	if (rel.startsWith("/fi")) return "fi";
	return "en";
}

function patchLinks(doc: Document): void {
	if (!BASE_PREFIX) return;
	for (const a of doc.querySelectorAll<HTMLAnchorElement>("a[href^='/']")) {
		const href = a.getAttribute("href") ?? "";
		if (!href.startsWith(BASE_PREFIX)) a.setAttribute("href", BASE_PREFIX + href);
	}
}

function onFrameLoad(): void {
	teardown?.();
	teardown = null;

	const currentCfg = cfg.value;
	if (!currentCfg) return;

	const doc = frame.value?.contentDocument;
	if (!doc) return;

	const currentLocale = locale.value;
	const { cleanup, makeEditable } = initInlineEditor({
		doc,
		onStatus: () => undefined,
		onSave: async (editId, text) => {
			await writeField(currentCfg, currentLocale, editId, esc(text));
		},
		onAttrSave: async (editId, attrName, value) => {
			await writeAttr(currentCfg, currentLocale, editId, attrName, esc(value));
		},
	});

	const cleanupArrays = initArrayEditor({
		doc,
		makeEditable,
		onStatus: () => undefined,
		onArraySave: async (arrayId, items) => {
			await writeArray(currentCfg, currentLocale, arrayId, items);
		},
	});

	patchLinks(doc);

	teardown = () => {
		cleanup();
		cleanupArrays();
	};
}

function onIframeLoad(): void {
	if (!frame.value?.getAttribute("src")) return;
	const pathname = frame.value.contentWindow?.location.pathname ?? "";
	locale.value = detectLocale(pathname);
	onFrameLoad();
}

function onConnect(newCfg: GhConfig): void {
	cfg.value = newCfg;
	if (frame.value) frame.value.src = localePath("en");
}

function onDisconnect(): void {
	cfg.value = null;
	teardown?.();
	teardown = null;
	if (frame.value) frame.value.src = "";
}

function startResize(e: MouseEvent): void {
	e.preventDefault();
	const startX = e.clientX;
	const startWidth = chatWidth.value;
	isResizing.value = true;

	const ac = new AbortController();
	const { signal } = ac;

	document.addEventListener(
		"mousemove",
		(ev) => {
			const maxChat = window.innerWidth - HANDLE_WIDTH - MIN_FRAME_WIDTH;
			chatWidth.value = Math.max(MIN_CHAT_WIDTH, Math.min(maxChat, startWidth + ev.clientX - startX));
		},
		{ signal },
	);

	document.addEventListener(
		"mouseup",
		() => {
			isResizing.value = false;
			localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth.value));
			ac.abort();
		},
		{ signal, once: true },
	);
}

onMounted(() => {
	if (cfg.value && frame.value) frame.value.src = localePath("en");
});

onBeforeUnmount(() => teardown?.());
</script>

<template>
	<main class="ed-split" :style="{ gridTemplateColumns: `${chatWidth}px 4px 1fr` }">
		<AiChat
			:config="cfg"
			:locale="locale"
			:frame-el="frame ?? null"
			@connect="onConnect"
			@disconnect="onDisconnect"
			@status="() => undefined"
		/>
		<div class="ed-resize" :class="{ 'is-dragging': isResizing }" @mousedown="startResize" />
		<iframe ref="frame" class="ed-frame" :class="{ 'is-resizing': isResizing }" title="Site preview" @load="onIframeLoad" />
	</main>
</template>

<style>
	body {
		display: grid;
		grid-template-rows: 1fr;
		block-size: 100dvh;
		overflow: hidden;
	}

	#app {
		display: contents;
	}

	.ed-split {
		display: grid;
		overflow: hidden;
		container-type: inline-size;
		container-name: ed-split;
	}

	.ed-resize {
		background-color: var(--border);
		cursor: col-resize;
		transition: background-color var(--transition-fast);
	}

	.ed-resize:hover,
	.ed-resize.is-dragging {
		background-color: var(--accent);
	}

	.ed-frame {
		border: 0;
		inline-size: 100%;
		block-size: 100%;
	}

	.ed-frame.is-resizing {
		pointer-events: none;
	}
</style>
