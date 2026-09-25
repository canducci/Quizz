import { createHmac, timingSafeEqual } from "node:crypto";

export const LEARNER_COOKIE = "quizz_learner";

// ponytail: a day covers the longest time limit; ticket 08 may tie it to the Attempt's deadline.
const DAY = 24 * 60 * 60_000;

const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(`learner:${body}`).digest("base64url");

/** Proof that this browser verified `email` for one Assessment. Holds the plain email for the Certificate email. */
export function learnerToken(
  assessmentId: string,
  email: string,
  now = new Date(),
  secret = process.env.EMAIL_HMAC_SECRET!,
) {
  const body = Buffer.from(
    JSON.stringify({ a: assessmentId, e: email, x: now.getTime() + DAY }),
  ).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The verified email, or null if the token is forged, expired or for another Assessment. */
export function learnerEmail(
  token: string | undefined,
  assessmentId: string,
  now = new Date(),
  secret = process.env.EMAIL_HMAC_SECRET!,
) {
  const [body, sig] = token?.split(".") ?? [];
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const { a, e, x } = JSON.parse(Buffer.from(body, "base64url").toString());
  return a === assessmentId && x > now.getTime() ? (e as string) : null;
}
