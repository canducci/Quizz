"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  closeAssessment,
  deleteAssessment,
  publishAssessment,
  reopenAssessment,
} from "@/app/assessments/actions";
import type { AssessmentStatus } from "@/db/schema";
import type { PublishProblem } from "@/domain/publish";

export function PublishButton(props: {
  assessmentId: string;
  version: number;
  changed: boolean;
  ready: boolean;
}) {
  const t = useTranslations("publishTab");
  const label = !props.version
    ? t("publish")
    : props.changed
      ? t("asVersion", { n: props.version + 1 })
      : t("upToDate", { n: props.version });
  return (
    <form action={publishAssessment.bind(null, props.assessmentId)}>
      <button className="publish" disabled={!props.ready || !props.changed}>
        {label}
      </button>
    </form>
  );
}

export function PublishTab(props: {
  assessmentId: string;
  status: AssessmentStatus;
  version: number;
  changed: boolean;
  problems: PublishProblem[];
  learnerUrl: string;
}) {
  const t = useTranslations("publishTab");
  const format = useFormatter();
  const id = props.assessmentId;
  return (
    <div className="settings">
      {props.problems.length ? (
        <div className="problems">
          <b>{t("blocked")}</b>
          <ul>
            {props.problems.map((p, i) => (
              <li key={i}>
                {p.code === "noBranding"
                  ? t("problems.noBranding", {
                      missing: format.list(p.missing.map((f) => t(`brandingFields.${f}`))),
                    })
                  : t(`problems.${p.code}`, p)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>{props.changed ? t("ready") : t("noChanges")}</p>
      )}
      {props.status === "draft" && <p className="muted">{t("draftHint")}</p>}
      <PublishButton
        assessmentId={id}
        version={props.version}
        changed={props.changed}
        ready={!props.problems.length}
      />

      <h2>{t("status")}</h2>
      {props.status === "draft" ? (
        <form
          action={deleteAssessment.bind(null, id)}
          onSubmit={(e) => {
            if (!confirm(t("confirmDelete"))) e.preventDefault();
          }}
        >
          <button className="danger">{t("delete")}</button>
        </form>
      ) : (
        <>
          <p>{t(props.status === "closed" ? "closedHint" : "publishedHint")}</p>
          <p>
            {t("learnerLink")} <a href={props.learnerUrl}>{props.learnerUrl}</a>
          </p>
          <form
            action={(props.status === "closed" ? reopenAssessment : closeAssessment).bind(null, id)}
          >
            <button>{t(props.status === "closed" ? "reopen" : "close")}</button>
          </form>
          <p className="muted">{t("noDelete")}</p>
        </>
      )}
    </div>
  );
}
