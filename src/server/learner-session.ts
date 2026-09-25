import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const LEARNER_COOKIE = "quizz_learner";
/** My Certificates' own verification, so it never replaces an Assessment's. Its token's scope is
 * MINE instead of an Assessment id. */
export const MINE_COOKIE = "quizz_mine";
export const MINE = "my-certificates";

// A day covers the longest time limit; starting an Attempt issues a fresh token.
const DAY = 24 * 60 * 60_000;

const key = (secret: string) => createHash("sha256").update(`learner:${secret}`).digest();

/** Proof that this browser verified `email` for one Assessment. Encrypted (ADR 0002): it carries
 * the plain email only so the Certificate email can be sent later. */
export function learnerToken(
  assessmentId: string,
  email: string,
  now = new Date(),
  secret = process.env.EMAIL_HMAC_SECRET!,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ a: assessmentId, e: email, x: now.getTime() + DAY })),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The verified email, or null if the token is forged, expired or for another Assessment. */
export function learnerEmail(
  token: string | undefined,
  assessmentId: string,
  now = new Date(),
  secret = process.env.EMAIL_HMAC_SECRET!,
) {
  if (!token) return null;
  const raw = Buffer.from(token, "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    const { a, e, x } = JSON.parse(plain.toString());
    return a === assessmentId && x > now.getTime() ? (e as string) : null;
  } catch {
    return null; // forged, truncated or from another secret
  }
}
