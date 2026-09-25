"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale } from "./locales";

export async function setLocale(formData: FormData) {
  (await cookies()).set(LOCALE_COOKIE, toLocale(formData.get("locale")?.toString()), {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
