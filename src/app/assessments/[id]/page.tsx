import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QuestionsEditor } from "@/components/questions-editor";
import { AccessForm, RulesForm } from "@/components/settings-forms";
import { db } from "@/db";
import { ownAssessment, questionPool } from "@/server/assessments";
import { requireCreator } from "@/server/auth";
import { inviteCount } from "@/server/invites";

const TABS = ["questions", "rules", "access"] as const;

export default async function Editor(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireCreator();
  const assessment = await ownAssessment((await props.params).id, me.id);
  if (!assessment) notFound();
  const { tab: asked } = await props.searchParams;
  const tab = TABS.find((name) => name === asked) ?? "questions";
  const pool = await questionPool(assessment.id);
  const t = await getTranslations("editor");
  const status = await getTranslations("assessmentStatus");

  return (
    <div className="editor">
      <div className="topbar">
        <h1>{assessment.title}</h1>
        <span className="pill">{status(assessment.status)}</span>
        <nav className="tabs">
          {TABS.map((name) => (
            <Link key={name} href={`?tab=${name}`} aria-current={name === tab ? "page" : undefined}>
              {t(`tabs.${name}`, { n: pool.length })}
            </Link>
          ))}
          {/* Built in a later ticket. */}
          <span aria-disabled="true">{t("tabs.publish")}</span>
        </nav>
      </div>
      {tab === "questions" && <QuestionsEditor assessmentId={assessment.id} pool={pool} />}
      {tab === "rules" && <RulesForm assessment={assessment} poolSize={pool.length} />}
      {tab === "access" && (
        <AccessForm assessment={assessment} invited={await inviteCount(db, assessment.id)} />
      )}
    </div>
  );
}
