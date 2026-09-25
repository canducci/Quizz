import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/i18n/actions";
import Link from "next/link";
import { currentCreator } from "@/server/auth";
import { SignOutButton } from "@/components/sign-out-button";
import "./globals.css";

export const metadata: Metadata = { title: "Quizz" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("header");
  const me = await currentCreator();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <header className="header">
            <strong>Quizz</strong>
            <nav className="nav">
              {me && (
                <>
                  <Link href="/dashboard">{t("assessments")}</Link>
                  <Link href="/certificates">{t("certificates")}</Link>
                  <Link href="/settings">{t("settings")}</Link>
                </>
              )}
              <Link href="/me">{t("myCertificates")}</Link>
            </nav>
            <form action={setLocale} className="language" aria-label={t("language")}>
              <button name="locale" value="en" aria-pressed={locale === "en"}>
                EN
              </button>
              <button name="locale" value="pt-BR" aria-pressed={locale === "pt-BR"}>
                PT
              </button>
            </form>
            {me && <SignOutButton label={t("signOut")} />}
          </header>
          <main className="main">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
