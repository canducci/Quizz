"use server";

import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { learnerAssessment } from "@/server/assessments";
import { isInvited } from "@/server/invites";
import { redirect } from "next/navigation";
import { saveAnswer, startAttempt, submitAttempt } from "@/server/attempts";
import { emailHash, normalizeEmail, parseEmailList } from "@/server/email-hash";
import { LEARNER_COOKIE, learnerEmail, learnerToken } from "@/server/learner-session";
import { sendMail } from "@/server/mail";
import { countEmail, requestCode, sentToday, verifyCode } from "@/server/one-time-code";
import { brandingImages, certificatePdf, type CertificateFacts } from "@/server/certificate-pdf";
import { formatId, verificationUrl, type CertificateVersion } from "@/domain/certificate";
import { learnerCertificate } from "@/server/certificates";
import { CODE_MINUTES } from "@/domain/one-time-code";

const DAILY_CAP = Number(process.env.DAILY_EMAIL_CAP) || 300;

export type EntryError =
  | { reason: "badEmail" | "sendFailed" | "dailyCap" | "email" | "ip" | "locked" | "expired" }
  | { reason: "wrong"; left: number }
  | { reason: "notInvited" | "closed"; creator: string };

/** An open Assessment, or the error a Learner sees. Ids from the browser are never trusted. */
async function openAssessment(id: string) {
  const row = await learnerAssessment(id);
  if (!row) throw new Error("No such Assessment");
  if (row.status === "closed")
    return { error: { reason: "closed" as const, creator: row.snapshot.branding.name } };
  return { snapshot: row.snapshot };
}

// ponytail: Next passes a client-sent X-Forwarded-For through untouched, so the per-IP limit
// only holds behind a proxy that overwrites it. The per-email limit and daily cap hold regardless.
async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function requestLearnerCode(
  assessmentId: string,
  typed: string,
): Promise<EntryError | null> {
  const { snapshot, error } = await openAssessment(assessmentId);
  if (error) return error;
  const [email] = parseEmailList(typed).emails;
  if (!email || normalizeEmail(typed) !== email) return { reason: "badEmail" };
  const sent = await requestCode(db, {
    email,
    ip: await clientIp(),
    purpose: "attempt",
    cap: DAILY_CAP,
  });
  if (!sent.ok) return { reason: sent.reason };
  const t = await getTranslations({
    locale: snapshot.settings.language,
    namespace: "learner.mail",
  });
  const values = { title: snapshot.title, code: sent.code, minutes: CODE_MINUTES };
  try {
    await sendMail(email, t("subject", values), t("body", values));
  } catch {
    return { reason: "sendFailed" };
  }
  return null;
}

/** Spends the code, then (only then) checks the Invite-only list and marks this browser verified. */
export async function verifyLearnerCode(
  assessmentId: string,
  email: string,
  code: string,
): Promise<EntryError | null> {
  const { snapshot, error } = await openAssessment(assessmentId);
  if (error) return error;
  const checked = await verifyCode(db, { email, code, purpose: "attempt" });
  if (!checked.ok) return checked;
  if (snapshot.settings.accessMode === "invite") {
    if (!(await isInvited(db, assessmentId, email)))
      return { reason: "notInvited", creator: snapshot.branding.name };
  }
  await remember(assessmentId, normalizeEmail(email));
  return null;
}

async function remember(assessmentId: string, email: string) {
  (await cookies()).set(LEARNER_COOKIE, learnerToken(assessmentId, email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https:"),
    maxAge: 24 * 60 * 60,
  });
}

/** The verified Learner's email hash; a missing or stale cookie sends them back to verify. */
async function learner(assessmentId: string) {
  const email = learnerEmail((await cookies()).get(LEARNER_COOKIE)?.value, assessmentId);
  if (!email) redirect(`/a/${assessmentId}`);
  return { email, hash: emailHash(email) };
}

/** Starts (or resumes) an Attempt; the page then shows it. Invites are checked again: they apply at once. */
export async function startLearnerAttempt(assessmentId: string): Promise<EntryError | null> {
  const { snapshot, error } = await openAssessment(assessmentId);
  if (error) return error;
  const { email, hash } = await learner(assessmentId);
  if (snapshot.settings.accessMode === "invite" && !(await isInvited(db, assessmentId, email)))
    return { reason: "notInvited", creator: snapshot.branding.name };
  const started = await startAttempt(db, { assessmentId, learner: hash });
  if (!started) return { reason: "closed", creator: snapshot.branding.name };
  // A fresh cookie outlives the deadline (the longest time limit is a day), so the Learner can resume.
  await remember(assessmentId, email);
  return null;
}

export async function saveLearnerAnswer(assessmentId: string, questionId: string, choice: unknown) {
  const { hash } = await learner(assessmentId);
  return saveAnswer(db, { assessmentId, learner: hash, questionId, choice });
}

/** Only the score, pass/fail and whether the Certificate email went out go back to the browser. */
export async function submitLearnerAttempt(assessmentId: string, name: string) {
  const { email, hash } = await learner(assessmentId);
  const result = await submitAttempt(db, { assessmentId, learner: hash, name: String(name) });
  if (!result.ok) return result;
  const { score, passed, certificate, version } = result;
  const mailed = !certificate || (await mailCertificate(email, certificate, version));
  return { ok: true as const, score, passed, mailed };
}

/** Emails the Learner's Certificate again. Unlike the first email, a resend respects the daily cap.
 * ponytail: no per-Learner limit; it only reaches their own verified email, and the cap bounds it. */
export async function resendLearnerCertificate(
  assessmentId: string,
): Promise<"sent" | "dailyCap" | "sendFailed"> {
  const { email, hash } = await learner(assessmentId);
  const found = await learnerCertificate(db, assessmentId, hash);
  if (!found) redirect(`/a/${assessmentId}`);
  if ((await sentToday(db)) >= DAILY_CAP) return "dailyCap";
  return (await mailCertificate(email, found.certificate, found.version)) ? "sent" : "sendFailed";
}

/** Sends the Certificate PDF and counts it towards the daily cap, which never refuses it. False if
 * it couldn't be sent: the Learner is told and can send it again. */
async function mailCertificate(email: string, cert: CertificateFacts, version: CertificateVersion) {
  const { snapshot } = version;
  try {
    const pdf = await certificatePdf(cert, version, await brandingImages(snapshot));
    const t = await getTranslations({
      locale: snapshot.settings.language,
      namespace: "certificate",
    });
    const values = {
      name: cert.holderName,
      title: snapshot.title,
      score: cert.score,
      creator: snapshot.branding.name,
      url: verificationUrl(cert.publicId),
    };
    await sendMail(email, t("mail.subject", values), t("mail.body", values), [
      { filename: t("file", { id: formatId(cert.publicId) }), content: pdf },
    ]);
    await countEmail(db);
    return true;
  } catch (e) {
    console.error(`Certificate ${cert.publicId} not emailed`, e);
    return false;
  }
}
