const RE_UPPER = /[A-Z]/;
const RE_DIGIT = /[0-9]/;
const RE_SPECIAL = /[^A-Za-z0-9]/;

export const DEFAULT_STRENGTH_LABELS: Record<number, string> = {
	0: "Enter password",
	1: "Very weak",
	2: "Weak",
	3: "Medium",
	4: "Strong",
};

export function calcPasswordStrength(password: string): number {
	let score = 0;
	if (password.length >= 8) score++;
	if (RE_UPPER.test(password)) score++;
	if (RE_DIGIT.test(password)) score++;
	if (RE_SPECIAL.test(password)) score++;
	return score;
}

export function updatePasswordStrength(
	passwordInput: HTMLInputElement,
	strengthMeter: HTMLElement,
	strengthLabel: HTMLElement,
	labels: Record<number, string> = DEFAULT_STRENGTH_LABELS,
): void {
	const score = passwordInput.value.length > 0 ? calcPasswordStrength(passwordInput.value) : 0;
	strengthMeter.dataset.strength = String(score);
	strengthLabel.textContent = labels[score] ?? "";
}

export function syncPasswordConfirmValidity(
	passwordInput: HTMLInputElement,
	confirmInput: HTMLInputElement,
	errorEl: HTMLElement | null,
	message = "Passwords do not match",
): void {
	const mismatch = confirmInput.value.length > 0 && confirmInput.value !== passwordInput.value;
	confirmInput.setCustomValidity(mismatch ? message : "");
	if (errorEl) errorEl.hidden = !mismatch;
}

export function togglePasswordVisibility(button: HTMLButtonElement, input: HTMLInputElement): void {
	const isVisible = input.type === "text";
	input.type = isVisible ? "password" : "text";
	button.setAttribute("aria-pressed", isVisible ? "false" : "true");
	button.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
}

export function handlePasswordToggleClick(e: Event, root: ParentNode = document): void {
	const button = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-js-action="toggle-password"]');
	if (!button) return;
	const target = button.dataset.jsTarget;
	if (!target) return;
	const input = root.querySelector<HTMLInputElement>(`input[data-js-target="${target}"]`);
	if (!input) return;
	togglePasswordVisibility(button, input);
}
