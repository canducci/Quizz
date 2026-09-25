import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QuestionsEditor } from "@/components/questions-editor";
import { PublishButton, PublishTab } from "@/components/publish-tab";
import { AccessForm, RulesForm } from "@/components/settings-forms";
import { db } from "@/db";
import { ownAssessment, questionPool } from "@/server/assessments";
import { requireCreator } from "@/server/auth";
import { inviteCount } from "@/server/invites";
import { publishState } from "@/server/publish";

const TABS = ["questions", "rules", "access", "publish"] as const;

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
  const tPublish = await getTranslations("publishTab");
  const { problems, version, changed } = (await publishState(db, assessment.id, me.id))!;

  return (
    <div className="editor">
      <div className="topbar">
        <h1>{assessment.title}</h1>
        <span className="pill">
          {status(assessment.status)}
          {version > 0 && ` · ${tPublish("version", { n: version })}`}
        </span>
        <nav className="tabs">
          {TABS.map((name) => (
            <Link key={name} href={`?tab=${name}`} aria-current={name === tab ? "page" : undefined}>
              {t(`tabs.${name}`, { n: pool.length })}
            </Link>
          ))}
        </nav>
        <PublishButton
          assessmentId={assessment.id}
          version={version}
          changed={changed}
          ready={!problems.length}
        />
      </div>
      {version > 0 && changed && (
        <p className="versionwarn">
          {tPublish("newVersion", { next: version + 1, current: version })}
        </p>
      )}
      {tab === "questions" && <QuestionsEditor assessmentId={assessment.id} pool={pool} />}
      {tab === "rules" && <RulesForm assessment={assessment} poolSize={pool.length} />}
      {tab === "access" && (
        <AccessForm assessment={assessment} invited={await inviteCount(db, assessment.id)} />
      )}
      {tab === "publish" && (
        <PublishTab
          assessmentId={assessment.id}
          status={assessment.status}
          version={version}
          changed={changed}
          problems={problems}
        />
      )}
    </div>
  );
}
