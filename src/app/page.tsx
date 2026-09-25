import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/sign-in-form";
import { currentCreator } from "@/server/auth";
import { googleEnabled } from "@/server/env";

export default async function Home(props: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  if (await currentCreator()) redirect("/dashboard");
  const t = await getTranslations("signIn");
  const { error, deleted } = await props.searchParams;

  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      {deleted && <p role="status">{t("deleted")}</p>}
      {error && <p role="alert">{t("refused")}</p>}
      <p>{t("intro")}</p>
      <SignInForm google={googleEnabled()} />
    </section>
  );
}
