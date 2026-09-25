export const locales = ["en", "pt-BR"] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function toLocale(value: string | undefined): Locale {
  return locales.find((l) => l === value) ?? "en";
}
