import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QuestionsEditor } from "@/components/questions-editor";
import { ownAssessment, questionPool } from "@/server/assessments";
import { currentCreator } from "@/server/auth";

export default async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentCreator();
  if (!me) redirect("/");
  const assessment = await ownAssessment((await params).id, me.id);
  if (!assessment) notFound();
  const pool = await questionPool(assessment.id);
  const t = await getTranslations("editor");

  return (
    <div className="editor">
      <div className="topbar">
        <h1>{assessment.title}</h1>
        <span className="pill">{t(`status.${assessment.status}`)}</span>
        <nav className="tabs">
          <span aria-current="page">{t("tabs.questions", { n: pool.length })}</span>
          {/* Built in later tickets. */}
          <span aria-disabled="true">{t("tabs.rules")}</span>
          <span aria-disabled="true">{t("tabs.access")}</span>
          <span aria-disabled="true">{t("tabs.publish")}</span>
        </nav>
      </div>
      <QuestionsEditor assessmentId={assessment.id} pool={pool} />
    </div>
  );
}
