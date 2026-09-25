import { and, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { bump } from "./attempts";
import { stillValid } from "./certificates";

type Db = LibSQLDatabase<typeof schema>;
const { account, assessment, certificate, creator, session, user } = schema;

/** A Creator Ban, found by the sign-in email: sets `banned_at`, revokes every Valid Certificate
 * (each counted as revoked today), closes the Creator's Assessments and signs them out. The login
 * stays, so the email can't come back as a new Creator. Idempotent: a second run revokes nothing
 * and keeps the first date. Null if no Creator signs in with that email. */
export async function banCreator(db: Db, email: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: creator.id, authUserId: user.id })
      .from(creator)
      .innerJoin(user, eq(creator.authUserId, user.id))
      .where(eq(user.email, email.trim().toLowerCase()));
    if (!found) return null;
    await tx
      .update(creator)
      .set({ bannedAt: now })
      .where(and(eq(creator.id, found.id), isNull(creator.bannedAt)));
    const revoked = await tx
      .update(certificate)
      .set({ status: "revoked", statusAt: now, revocationReason: "Creator Ban" })
      .where(and(eq(certificate.creatorId, found.id), stillValid(now)))
      .returning({ versionId: certificate.versionId });
    for (const { versionId } of revoked) await bump(tx, versionId, now, ["revoked"]);
    await tx
      .update(assessment)
      .set({ status: "closed" })
      .where(and(eq(assessment.creatorId, found.id), eq(assessment.status, "published")));
    await tx.delete(session).where(eq(session.userId, found.authUserId));
    return { revoked: revoked.length };
  });
}

/** A Creator deletes their account: the login goes, the profile stays because Certificates point
 * at it, and those stay valid. */
export async function deleteCreatorAccount(db: Db, authUserId: string) {
  await db.transaction(async (tx) => {
    await tx.update(creator).set({ authUserId: null }).where(eq(creator.authUserId, authUserId));
    for (const table of [session, account])
      await tx.delete(table).where(eq(table.userId, authUserId));
    await tx.delete(user).where(eq(user.id, authUserId));
  });
}
