/**
 * shared/utils/locale.ts
 * The site's locale set — shared by the inline editor and any locale-aware UI.
 */

export type Locale = "en" | "ru" | "fi";

export const LOCALES: readonly Locale[] = ["en", "ru", "fi"] as const;

/** Narrow an arbitrary string to a known Locale. */
export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}
