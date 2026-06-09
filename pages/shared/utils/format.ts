export function createNumberFormatter(
	locale: Intl.LocalesArgument,
	options: Intl.NumberFormatOptions = {},
): (value: number) => string {
	const formatter = new Intl.NumberFormat(locale, options);
	return (value: number): string => formatter.format(value);
}

export function createCurrencyFormatter(
	locale: Intl.LocalesArgument,
	currency: string,
	options: Intl.NumberFormatOptions = {},
): (value: number) => string {
	const formatter = new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		...options,
	});
	return (value: number): string => formatter.format(value);
}
