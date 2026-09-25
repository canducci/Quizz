import { createHmac } from "node:crypto";

/** Trim and lowercase, nothing more: stored hashes depend on it never changing. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** The keyed hash every Learner email is stored as (ADR 0002). */
export function emailHash(email: string, secret = process.env.EMAIL_HMAC_SECRET!) {
  return createHmac("sha256", secret).update(normalizeEmail(email)).digest("hex");
}

/** Pasted emails, normalised and deduped; `invalid` counts tokens that aren't emails. */
export function parseEmailList(text: string) {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const emails = tokens.map(normalizeEmail).filter((t) => /^[^@]+@[^@]+$/.test(t));
  return { emails: [...new Set(emails)], invalid: tokens.length - emails.length };
}
