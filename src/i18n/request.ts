import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, messagesFor, toLocale } from "./locales";

// An explicit locale (`getTranslations({ locale })`, the Assessment Language) wins over the interface cookie.
export default getRequestConfig(async ({ locale: asked }) => {
  const locale = toLocale(asked ?? (await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: await messagesFor(locale) };
});
