import { longDateTime, shownStatus } from "./certificate";

/** A Learner's finished Attempt on the Assessment. A running one is resumed, never counted here. */
export type PastAttempt = { startedAt: Date; deadline: Date; submittedAt: Date | null };
export type HeldCertificate = {
  publicId: string;
  status: "valid" | "revoked" | "replaced";
  statusAt: Date | null;
  expiresAt: Date | null;
};

export type RetakeBlock =
  | { reason: "certificateHeld"; publicId: string; expiresAt: Date | null }
  | { reason: "attemptsUsed" }
  | { reason: "cooldown"; until: Date };

/** Why the Retake Policy refuses a new Attempt, or null if it may start. The count covers Attempts
 * started at or after the Learner's last Certificate Expiry, whatever the Certificate's status
 * since: a Revocation never resets the count, and never undoes a reset its Expiry made. The
 * cooldown runs from the last counted Attempt's submit or, for a Timed out one, its deadline. */
export function retakeBlock(
  attempts: PastAttempt[],
  certificates: HeldCertificate[],
  rules: { maxAttempts: number; cooldown: number },
  now: Date,
): RetakeBlock | null {
  const held = certificates.find((c) => shownStatus(c, now).status === "valid");
  if (held)
    return { reason: "certificateHeld", publicId: held.publicId, expiresAt: held.expiresAt };
  const expired = certificates.flatMap((c) =>
    c.expiresAt && c.expiresAt <= now ? [+c.expiresAt] : [],
  );
  const resetAt = Math.max(0, ...expired);
  const counted = attempts.filter((a) => +a.startedAt >= resetAt);
  if (counted.length >= rules.maxAttempts) return { reason: "attemptsUsed" };
  if (counted.length === 0) return null;
  const lastEnd = Math.max(...counted.map((a) => +(a.submittedAt ?? a.deadline)));
  const until = new Date(lastEnd + rules.cooldown * 60_000);
  return now < until ? { reason: "cooldown", until } : null;
}

/** A RetakeBlock as the Learner reads it, dates written out in the Assessment Language. */
export type ShownBlock =
  | { reason: "certificateHeld"; publicId: string; renewFrom?: string }
  | { reason: "attemptsUsed" }
  | { reason: "cooldown"; until: string };

export function shownBlock(block: RetakeBlock, locale: string): ShownBlock {
  if (block.reason === "cooldown") return { ...block, until: longDateTime(block.until, locale) };
  if (block.reason === "attemptsUsed") return block;
  const { publicId, expiresAt } = block;
  return {
    reason: block.reason,
    publicId,
    renewFrom: expiresAt ? longDateTime(expiresAt, locale) : undefined,
  };
}
