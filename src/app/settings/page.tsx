import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandingForm } from "@/components/branding-form";
import { currentCreator } from "@/server/auth";

export default async function Settings() {
  const me = await currentCreator();
  if (!me) redirect("/");
  const t = await getTranslations("settings");

  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <BrandingForm creator={me} />
    </section>
  );
}
