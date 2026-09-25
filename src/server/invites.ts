import { and, count, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { emailHash } from "./email-hash";

type Db = LibSQLDatabase<typeof schema>;
// Two bound values per row keeps each statement well under SQLite's variable limit.
const CHUNK = 1000;

const hashes = (emails: string[], secret?: string) => [
  ...new Set(emails.map((e) => emailHash(e, secret))),
];

/** Invites the emails; adding one already invited changes nothing. Returns how many are new. */
export async function addInvites(db: Db, assessmentId: string, emails: string[], secret?: string) {
  const all = hashes(emails, secret);
  let added = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < all.length; i += CHUNK) {
      const rows = all.slice(i, i + CHUNK).map((emailHash) => ({ assessmentId, emailHash }));
      const result = await tx.insert(schema.invite).values(rows).onConflictDoNothing();
      added += result.rowsAffected;
    }
  });
  return added;
}

/** Uninvites the emails. Returns how many were on the list. */
export async function removeInvites(
  db: Db,
  assessmentId: string,
  emails: string[],
  secret?: string,
) {
  const all = hashes(emails, secret);
  let removed = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < all.length; i += CHUNK) {
      const result = await tx
        .delete(schema.invite)
        .where(
          and(
            eq(schema.invite.assessmentId, assessmentId),
            inArray(schema.invite.emailHash, all.slice(i, i + CHUNK)),
          ),
        );
      removed += result.rowsAffected;
    }
  });
  return removed;
}

export async function inviteCount(db: Db, assessmentId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.invite)
    .where(eq(schema.invite.assessmentId, assessmentId));
  return row.n;
}
