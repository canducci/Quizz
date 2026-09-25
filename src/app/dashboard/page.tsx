import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentCreator } from "@/server/auth";

export default async function Dashboard() {
  if (!(await currentCreator())) redirect("/");
  const t = await getTranslations("dashboard");

  return (
    <section>
      <h1>{t("title")}</h1>
      <p>{t("empty")}</p>
    </section>
  );
}
