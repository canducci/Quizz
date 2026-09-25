"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { invite } from "@/db/schema";
import { learnerAssessment } from "@/server/assessments";
import { emailHash, normalizeEmail, parseEmailList } from "@/server/email-hash";
import { LEARNER_COOKIE, learnerToken } from "@/server/learner-session";
import { sendMail } from "@/server/mail";
import { requestCode, verifyCode } from "@/server/one-time-code";

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
    cap: Number(process.env.DAILY_EMAIL_CAP) || 300,
  });
  if (!sent.ok) return { reason: sent.reason };
  const t = await getTranslations({
    locale: snapshot.settings.language,
    namespace: "learner.mail",
  });
  const values = { title: snapshot.title, code: sent.code };
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
    const [invited] = await db
      .select()
      .from(invite)
      .where(and(eq(invite.assessmentId, assessmentId), eq(invite.emailHash, emailHash(email))));
    if (!invited) return { reason: "notInvited", creator: snapshot.branding.name };
  }
  (await cookies()).set(LEARNER_COOKIE, learnerToken(assessmentId, normalizeEmail(email)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https:"),
    maxAge: 24 * 60 * 60,
  });
  return null;
}
