import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/sign-in-form";
import { currentCreator } from "@/server/auth";
import { googleEnabled } from "@/server/env";

export default async function Home() {
  if (await currentCreator()) redirect("/dashboard");
  const t = await getTranslations("signIn");

  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <SignInForm google={googleEnabled()} />
    </section>
  );
}
