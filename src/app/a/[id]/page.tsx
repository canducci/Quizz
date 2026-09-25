import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { AttemptView, StartButton } from "@/components/attempt-view";
import { EntryForm } from "@/components/entry-form";
import { learnerQuestions } from "@/domain/attempt";
import { messagesFor } from "@/i18n/locales";
import { latestAttempt } from "@/server/attempts";
import { learnerAssessment } from "@/server/assessments";
import { emailHash } from "@/server/email-hash";
import { LEARNER_COOKIE, learnerEmail } from "@/server/learner-session";

/** The Assessment link a Creator shares. Everything a Learner reads is in the Assessment Language. */
export default async function AssessmentLink(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const row = await learnerAssessment(id);
  if (!row) notFound();
  const { title, settings, branding } = row.snapshot;
  const locale = settings.language;
  const t = await getTranslations({ locale, namespace: "learner" });
  const verified = learnerEmail((await cookies()).get(LEARNER_COOKIE)?.value, id);
  const now = new Date();
  const last = verified && (await latestAttempt(db, id, emailHash(verified), now));
  const messages = await messagesFor(locale);
  const provide = (children: React.ReactNode) => (
    <NextIntlClientProvider
      locale={locale}
      messages={{ learner: messages.learner, attempt: messages.attempt }}
    >
      {children}
    </NextIntlClientProvider>
  );

  // A running Attempt comes first: closing the Assessment doesn't stop one already started.
  if (last && last.attempt.outcome === "in_progress")
    return (
      <div lang={locale}>
        {provide(
          <AttemptView
            assessmentId={id}
            creator={branding.name}
            title={title}
            // The Attempt's own Version, which may be older than the current one.
            questions={learnerQuestions(last.snapshot.questions, last.attempt.drawn)}
            answers={last.attempt.answers}
            remainingMs={last.attempt.deadline.getTime() - now.getTime()}
          />,
        )}
      </div>
    );

  return (
    <div className="learn" lang={locale}>
      <aside>
        <div>
          <b>{branding.name}</b>
          <div className="muted">{title}</div>
        </div>
        <div className="muted">
          {t("facts", {
            drawn: settings.drawn,
            minutes: settings.timeLimit,
            passing: settings.passingScore,
            attempts: settings.maxAttempts,
          })}
        </div>
        <div className="muted powered">{t("powered")}</div>
      </aside>
      <div className="paper">
        <h1>{title}</h1>
        <p className="muted">{t("by", { creator: branding.name })}</p>
        {last && (
          <div className="result" role="region" aria-label={t("resultLabel")}>
            {last.attempt.outcome === "timed_out" ? (
              <>
                <h2>{t("timedOut")}</h2>
                <p>{t("timedOutBody")}</p>
              </>
            ) : (
              <>
                <h2>{t(last.attempt.passed ? "passed" : "failed")}</h2>
                <p className="score">{t("score", { score: last.attempt.score! })}</p>
                {last.attempt.passed && <p>{t("certificateSent", { email: verified })}</p>}
                <p className="muted">
                  {t("passingWas", { passing: last.snapshot.settings.passingScore })}{" "}
                  {t("noReview")}
                </p>
              </>
            )}
          </div>
        )}
        {row.status === "closed" ? (
          <p role="alert">{t("errors.closed", { creator: branding.name })}</p>
        ) : (
          <>
            <table>
              <tbody>
                <tr>
                  <td>{t("questions")}</td>
                  <td>{t("questionsValue", { n: settings.drawn })}</td>
                </tr>
                <tr>
                  <td>{t("timeLimit")}</td>
                  <td>{t("timeLimitValue", { n: settings.timeLimit })}</td>
                </tr>
                <tr>
                  <td>{t("passingScore")}</td>
                  <td>{settings.passingScore}%</td>
                </tr>
                <tr>
                  <td>{t("attempts")}</td>
                  <td>
                    {t("attemptsValue", { n: settings.maxAttempts, cooldown: settings.cooldown })}
                  </td>
                </tr>
                <tr>
                  <td>{t("timeout")}</td>
                  <td>{t("timeoutValue")}</td>
                </tr>
              </tbody>
            </table>
            {settings.accessMode === "invite" && <p>{t("inviteOnly")}</p>}
            {verified ? (
              <>
                <p role="status">{t("verified", { email: verified })}</p>
                <p className="muted">{t("verifiedHint", { minutes: settings.timeLimit })}</p>
                {provide(<StartButton assessmentId={id} again={!!last} />)}
              </>
            ) : (
              provide(<EntryForm assessmentId={id} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
