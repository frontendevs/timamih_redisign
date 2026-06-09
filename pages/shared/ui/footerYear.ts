/* Sets the current year on [data-js-target="footer-year"] if present.
 * Returns a (no-op) cleanup so it composes in the bootstrap() array.
 */
export function footerYear(): () => void {
	const node = document.querySelector('[data-js-target="footer-year"]');
	if (node) node.textContent = String(new Date().getFullYear());
	return () => {};
}
