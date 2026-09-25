"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { CODE_MINUTES } from "@/domain/one-time-code";
import { correctName, eraseLearner } from "@/server/certificates";
import { mailCertificate } from "@/server/certificate-mail";
import { emailHash, normalizeEmail, parseEmailList } from "@/server/email-hash";
import { DAILY_CAP, clientIp } from "@/server/learner-request";
import {
  LEARNER_COOKIE,
  MINE,
  MINE_COOKIE,
  learnerEmail,
  learnerToken,
} from "@/server/learner-session";
import { sendMail } from "@/server/mail";
import { requestCode, verifyCode } from "@/server/one-time-code";
import type { EntryError } from "@/app/a/[id]/actions";

/** Sends a My Certificates code, in the interface language: it isn't about any one Assessment. */
export async function requestMyCode(typed: string): Promise<EntryError | null> {
  const [email] = parseEmailList(typed).emails;
  if (!email || normalizeEmail(typed) !== email) return { reason: "badEmail" };
  const sent = await requestCode(db, {
    email,
    ip: await clientIp(),
    purpose: "my-certificates",
    cap: DAILY_CAP,
  });
  if (!sent.ok) return { reason: sent.reason };
  const t = await getTranslations({ locale: await getLocale(), namespace: "mine.mail" });
  const values = { code: sent.code, minutes: CODE_MINUTES };
  try {
    await sendMail(email, t("subject", values), t("body", values));
  } catch {
    return { reason: "sendFailed" };
  }
  return null;
}

export async function verifyMyCode(email: string, code: string): Promise<EntryError | null> {
  const checked = await verifyCode(db, { email, code, purpose: "my-certificates" });
  if (!checked.ok) return checked;
  (await cookies()).set(MINE_COOKIE, learnerToken(MINE, normalizeEmail(email)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https:"),
    maxAge: 60 * 60,
  });
  return null;
}

/** The verified email; without one, back to the code. */
async function me() {
  const email = learnerEmail((await cookies()).get(MINE_COOKIE)?.value, MINE);
  if (!email) redirect("/me");
  return { email, hash: emailHash(email) };
}

/** Replaces one of the Learner's Valid Certificates with a corrected name, and emails the new one. */
export async function correctMyName(publicId: string, name: string) {
  const { email, hash } = await me();
  const done = await correctName(db, {
    learner: hash,
    publicId: String(publicId),
    name: String(name),
  });
  if (!done.ok) return done.reason;
  const mailed = await mailCertificate(email, done.certificate, done.version);
  redirect(`/me?done=${mailed ? "corrected" : "unsent"}`);
}

/** Learner Erasure, then forgets this browser's verification. */
export async function eraseMe() {
  const { hash } = await me();
  await eraseLearner(db, hash);
  const jar = await cookies();
  jar.delete(MINE_COOKIE);
  jar.delete(LEARNER_COOKIE);
  redirect("/me?done=erased");
}

export async function forgetMe() {
  (await cookies()).delete(MINE_COOKIE);
  redirect("/me");
}
