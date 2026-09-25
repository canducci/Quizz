import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAssessment } from "@/app/assessments/actions";
import { db } from "@/db";
import { assessment } from "@/db/schema";
import { currentCreator } from "@/server/auth";

export default async function Dashboard() {
  const me = await currentCreator();
  if (!me) redirect("/");
  const t = await getTranslations("dashboard");
  const status = await getTranslations("editor.status");
  const assessments = await db
    .select()
    .from(assessment)
    .where(eq(assessment.creatorId, me.id))
    .orderBy(desc(assessment.createdAt));

  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      {assessments.length ? (
        <ul>
          {assessments.map((a) => (
            <li key={a.id}>
              <Link href={`/assessments/${a.id}`}>{a.title}</Link> · {status(a.status)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("empty")}</p>
      )}
      <form action={createAssessment} className="row">
        <input
          name="title"
          required
          maxLength={200}
          aria-label={t("newTitle")}
          placeholder={t("newTitle")}
        />
        <button>{t("new")}</button>
      </form>
    </section>
  );
}
