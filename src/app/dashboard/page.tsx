import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createAssessment } from "@/app/assessments/actions";
import { creatorAssessments } from "@/server/assessments";
import { requireCreator } from "@/server/auth";

export default async function Dashboard() {
  const me = await requireCreator();
  const t = await getTranslations("dashboard");
  const status = await getTranslations("assessmentStatus");
  const assessments = await creatorAssessments(me.id);

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
