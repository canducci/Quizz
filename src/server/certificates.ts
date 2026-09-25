import { and, desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";

type Db = LibSQLDatabase<typeof schema>;
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

/** A Certificate as its Verification Page shows it, or null. Only public columns are read: the
 * Revocation reason and the replacement never leave the database. */
export async function verifiedCertificate(db: Db, publicId: string) {
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
