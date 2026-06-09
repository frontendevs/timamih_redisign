/* Toast — pairs with components/toast.css (singleton <output>).
 * CSS animates the show/fade; this owns the lifecycle: set text, clear after
 * HIDE_DELAY_MS (→ :empty → display:none), re-append to restart the animation.
 *
 * Cross-page: call queueToast(payload) before navigating; toast() reads + clears
 * it on load. <output> has an implicit role=status — no explicit role set
 * (redundant ARIA).
 */
const STORAGE_KEY = "toast"; // project-configurable: rename per app if collisions matter
const HIDE_DELAY_MS = 4000; // must match the toast-show CSS animation duration

type ToastType = "success" | "error";
interface ToastPayload {
	text: string;
	type: ToastType;
}

function isToastPayload(v: unknown): v is ToastPayload {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return typeof o.text === "string" && o.text.length <= 500 && (o.type === "success" || o.type === "error");
}

let toastEl: HTMLOutputElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function getToastEl(): HTMLOutputElement {
	if (toastEl) return toastEl;
	const existing = document.querySelector<HTMLOutputElement>('[data-js="toast"]');
	if (existing) return (toastEl = existing);
	const el = document.createElement("output"); // implicit role=status
	el.className = "toast";
	el.dataset.js = "toast";
	el.setAttribute("aria-live", "polite");
	document.body.append(el);
	return (toastEl = el);
}

export function showToast(text: string, type: ToastType = "success"): void {
	const el = getToastEl();
	if (hideTimer !== null) {
		clearTimeout(hideTimer);
		hideTimer = null;
	}
	el.remove(); // re-append resets the CSS animation
	el.textContent = text.slice(0, 500);
	el.dataset.type = type;
	document.body.append(el);
	hideTimer = setTimeout(() => {
		el.textContent = "";
		delete el.dataset.type;
		hideTimer = null;
	}, HIDE_DELAY_MS);
}

/** Queue a toast to show after the next navigation (cross-page). */
export function queueToast(payload: ToastPayload): void {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ text: payload.text.slice(0, 500), type: payload.type }));
}

/** Global behavior: shows a cross-page toast queued in sessionStorage. Returns cleanup. */
export function toast(): () => void {
	getToastEl();

	const stored = sessionStorage.getItem(STORAGE_KEY);
	sessionStorage.removeItem(STORAGE_KEY);
	if (stored) {
		try {
			const payload: unknown = JSON.parse(stored);
			if (isToastPayload(payload)) showToast(payload.text, payload.type);
		} catch {
			/* ignore malformed storage value */
		}
	}

	// Tear down on pagehide; also clear the node so a bfcache restore (pageshow
	// → re-init) never shows a stale toast left without an active timer.
	return () => {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		if (toastEl) {
			toastEl.textContent = "";
			delete toastEl.dataset.type;
		}
	};
}
