export interface PhoneFormat {
	code: string;
	area: number;
	local: number[];
}

export const CIS_PHONE_FORMATS: PhoneFormat[] = [
	{ code: "373", area: 2, local: [3, 3] },
	{ code: "374", area: 2, local: [3, 3] },
	{ code: "375", area: 2, local: [3, 2, 2] },
	{ code: "380", area: 2, local: [3, 2, 2] },
	{ code: "992", area: 2, local: [3, 4] },
	{ code: "993", area: 2, local: [3, 2, 2] },
	{ code: "994", area: 2, local: [3, 2, 2] },
	{ code: "996", area: 3, local: [3, 3] },
	{ code: "998", area: 2, local: [3, 2, 2] },
];

export const RU_PHONE_FORMAT: PhoneFormat = { code: "7", area: 3, local: [3, 2, 2] };

function applyPhoneFormat(format: PhoneFormat, digits: string): string {
	const rest = digits.slice(format.code.length);
	let result = `+${format.code}`;
	if (rest.length === 0) return result;

	result += ` (${rest.slice(0, format.area)}`;
	if (rest.length <= format.area) return result;

	let position = format.area;
	const first = format.local[0] ?? 3;
	result += `) ${rest.slice(position, position + first)}`;
	position += first;

	for (let i = 1; i < format.local.length; i++) {
		if (rest.length <= position) break;
		const size = format.local[i] ?? 2;
		result += `-${rest.slice(position, position + size)}`;
		position += size;
	}

	return result;
}

function countDigits(value: string): number {
	return value.replace(/\D/g, "").length;
}

function caretAfterDigit(formatted: string, digitIndex: number): number {
	if (digitIndex <= 0) return formatted.startsWith("+") ? 1 : 0;

	let seen = 0;
	for (const [i, char] of Array.from(formatted).entries()) {
		if (!/\d/.test(char)) continue;
		seen++;
		if (seen >= digitIndex) return i + 1;
	}
	return formatted.length;
}

export function formatPhone(raw: string, formats = CIS_PHONE_FORMATS, fallback = RU_PHONE_FORMAT): string {
	if (raw === "+") return "+";

	let digits = raw.replace(/\D/g, "");
	if (digits.length === 0) return "";
	if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;

	if (digits.length < 3 && formats.some((format) => format.code.startsWith(digits))) return `+${digits}`;

	const format = formats.find((candidate) => digits.startsWith(candidate.code));
	if (format) return applyPhoneFormat(format, digits);

	return applyPhoneFormat(fallback, digits.startsWith(fallback.code) ? digits : `${fallback.code}${digits}`);
}

export function initPhoneMask(
	input: HTMLInputElement,
	signal: AbortSignal,
	formatter: (value: string) => string = formatPhone,
): void {
	const onInput = (): void => {
		const raw = input.value;
		const selectionStart = input.selectionStart;
		const digitIndex = selectionStart === null ? null : countDigits(raw.slice(0, selectionStart));
		const formatted = formatter(raw);
		input.value = formatted;

		if (digitIndex !== null && document.activeElement === input) {
			const caret = caretAfterDigit(formatted, digitIndex);
			input.setSelectionRange(caret, caret);
		}
	};
	input.addEventListener("input", onInput, { signal });
}
