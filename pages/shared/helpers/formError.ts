/* Form error helpers for components/form.css.
 * JS/server errors are shown with .is-visible and hidden=false; [hidden] remains
 * the hard off switch used by markup and cleanup.
 */
export function showFormError(el: HTMLElement | null, text: string): void {
	if (!el) return;
	el.textContent = text;
	el.hidden = false;
	el.classList.add("is-visible");
}

export function clearFormError(el: HTMLElement | null): void {
	if (!el) return;
	el.textContent = "";
	el.classList.remove("is-visible");
	el.hidden = true;
}
