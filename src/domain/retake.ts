import { shownStatus } from "./certificate";

/** A Learner's finished Attempt on the Assessment. A running one is resumed, never counted here. */
export type PastAttempt = { startedAt: Date; deadline: Date; submittedAt: Date | null };
export type HeldCertificate = {
  publicId: string;
  status: "valid" | "revoked" | "replaced";
  statusAt: Date | null;
  expiresAt: Date | null;
};

export type RetakeBlock =
  | { reason: "certificate"; publicId: string; expiresAt: Date | null }
  | { reason: "used" }
  | { reason: "cooldown"; until: Date };

/** Why the Retake Policy refuses a new Attempt, or null if it may start. The count covers Attempts
 * started at or after the Learner's last Certificate Expiry; a Revocation never resets it. The
 * cooldown runs from the last counted Attempt's submit or, for a Timed out one, its deadline. */
export function retakeBlock(
  attempts: PastAttempt[],
  certificates: HeldCertificate[],
  rules: { maxAttempts: number; cooldown: number },
  now: Date,
): RetakeBlock | null {
  const shown = certificates.map((c) => ({ ...c, ...shownStatus(c, now) }));
  const held = shown.find((c) => c.status === "valid");
  if (held) return { reason: "certificate", publicId: held.publicId, expiresAt: held.expiresAt };
  const resetAt = Math.max(0, ...shown.filter((c) => c.status === "expired").map((c) => +c.since!));
  const counted = attempts.filter((a) => +a.startedAt >= resetAt);
  if (counted.length >= rules.maxAttempts) return { reason: "used" };
  const lastEnd = Math.max(0, ...counted.map((a) => +(a.submittedAt ?? a.deadline)));
  const until = new Date(lastEnd + rules.cooldown * 60_000);
  return counted.length && now < until ? { reason: "cooldown", until } : null;
}

/** When the next Attempt is allowed, as a Learner reads it: "25 September 2026 at 15:05 UTC". In
 * UTC, named, so the server's own zone never leaks in. */
export const dateTime = (d: Date, locale: string) =>
  d.toLocaleString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
