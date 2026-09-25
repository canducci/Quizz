import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EntryForm } from "@/components/entry-form";
import { messagesFor } from "@/i18n/locales";
import { learnerAssessment } from "@/server/assessments";
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
              </>
            ) : (
              <NextIntlClientProvider
                locale={locale}
                messages={{ learner: (await messagesFor(locale)).learner }}
              >
                <EntryForm assessmentId={id} />
              </NextIntlClientProvider>
            )}
          </>
        )}
      </div>
    </div>
  );
}
