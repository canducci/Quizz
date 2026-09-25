import { and, desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { certificateLookup, parsePublicId } from "../domain/certificate";
import { bump } from "./attempts";
import { emailHash } from "./email-hash";

type Db = LibSQLDatabase<typeof schema>;
export const MAX_REASON = 500;
const { assessmentVersion, certificate, creator } = schema;

/** The Learner's newest valid Certificate for the Assessment, with the Version it was earned on,
 * or null. `learner` is the email hash. */
export async function learnerCertificate(db: Db, assessmentId: string, learner: string) {
  const [row] = await db
    .select({
      certificate,
      version: { number: assessmentVersion.number, snapshot: assessmentVersion.snapshot },
    })
    .from(certificate)
    .innerJoin(assessmentVersion, eq(certificate.versionId, assessmentVersion.id))
    .where(
      and(
        eq(assessmentVersion.assessmentId, assessmentId),
        eq(certificate.emailHash, learner),
        eq(certificate.status, "valid"),
      ),
    )
    .orderBy(desc(certificate.issuedAt))
    .limit(1);
  return row ?? null;
}

/** A Certificate as its Verification Page shows it, whatever its status, or null. `typed` is the
 * id from the URL, dashed or not. Only public columns are read: the Revocation reason and the
 * replacement never leave the database. */
export async function publicCertificate(db: Db, typed: string) {
  const publicId = parsePublicId(typed);
  if (!publicId) return null;
  const [row] = await db
    .select({
      publicId: certificate.publicId,
      holderName: certificate.holderName,
      score: certificate.score,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      status: certificate.status,
      statusAt: certificate.statusAt,
      version: { number: assessmentVersion.number, snapshot: assessmentVersion.snapshot },
      creatorJoinedAt: creator.joinedAt,
    })
    .from(certificate)
    .innerJoin(assessmentVersion, eq(certificate.versionId, assessmentVersion.id))
    .innerJoin(creator, eq(certificate.creatorId, creator.id))
    .where(eq(certificate.publicId, publicId));
  return row ?? null;
}

/** The Creator's own Certificates matching what they typed (see `certificateLookup`), newest
 * first, with the private Revocation reason. Null if the text is no id, link or email. An email is
 * only ever compared by its hash. */
export async function creatorCertificates(
  db: Db,
  creatorId: string,
  typed: string,
  secret?: string,
) {
  const lookup = certificateLookup(typed);
  if (!lookup) return null;
  return db
    .select({
      publicId: certificate.publicId,
      holderName: certificate.holderName,
      score: certificate.score,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      status: certificate.status,
      statusAt: certificate.statusAt,
      revocationReason: certificate.revocationReason,
      version: { number: assessmentVersion.number, snapshot: assessmentVersion.snapshot },
    })
    .from(certificate)
    .innerJoin(assessmentVersion, eq(certificate.versionId, assessmentVersion.id))
    .where(
      and(
        eq(certificate.creatorId, creatorId),
        "email" in lookup
          ? eq(certificate.emailHash, emailHash(lookup.email, secret))
          : eq(certificate.publicId, lookup.publicId),
      ),
    )
    .orderBy(desc(certificate.issuedAt));
}

/** Revokes one of the Creator's valid Certificates and counts it as revoked on today's
 * statistics. False if the reason is blank or the Certificate isn't theirs or isn't valid. */
export async function revokeCertificate(
  db: Db,
  opts: { creatorId: string; publicId: string; reason: string; now?: Date },
) {
  const reason = opts.reason.trim().slice(0, MAX_REASON);
  if (!reason) return false;
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [done] = await tx
      .update(certificate)
      .set({ status: "revoked", statusAt: now, revocationReason: reason })
      .where(
        and(
          eq(certificate.publicId, opts.publicId),
          eq(certificate.creatorId, opts.creatorId),
          eq(certificate.status, "valid"),
        ),
      )
      .returning({ versionId: certificate.versionId });
    if (!done) return false;
    await bump(tx, done.versionId, now, ["revoked"]);
    return true;
  });
}
