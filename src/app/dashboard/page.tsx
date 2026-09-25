import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";

export default async function Dashboard() {
  if (!(await auth.api.getSession({ headers: await headers() }))) redirect("/");
  const t = await getTranslations("dashboard");

  return (
    <section>
      <h1>{t("title")}</h1>
      <p>{t("empty")}</p>
    </section>
  );
}
