import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/sign-in-form";
import { auth } from "@/server/auth";
import { googleEnabled } from "@/server/env";

export default async function Home() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/dashboard");
  const t = await getTranslations("signIn");

  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <SignInForm google={googleEnabled()} />
    </section>
  );
}
