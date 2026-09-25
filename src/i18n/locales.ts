export const locales = ["en", "pt-BR"] as const;
export type Locale = (typeof locales)[number];
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function toLocale(value: string | undefined): Locale {
  return locales.find((l) => l === value) ?? "en";
}

export async function messagesFor(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}
