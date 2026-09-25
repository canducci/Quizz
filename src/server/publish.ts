import { and, asc, eq, isNull, max } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { v7 as uuidv7 } from "uuid";
import * as schema from "../db/schema";
import { publishProblems, snapshotOf } from "../domain/publish";

type Db = LibSQLDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const { assessment, assessmentVersion, creator, question } = schema;

/** What publishing the Creator's Assessment would do now, or null if it isn't theirs. */
export async function publishState(db: Db | Tx, assessmentId: string, creatorId: string) {
  const [row] = await db
    .select()
    .from(assessment)
    .innerJoin(creator, eq(assessment.creatorId, creator.id))
    .where(and(eq(assessment.id, assessmentId), eq(assessment.creatorId, creatorId)));
  if (!row) return null;
  const pool = await db
    .select()
    .from(question)
    .where(and(eq(question.assessmentId, assessmentId), isNull(question.deletedAt)))
    .orderBy(asc(question.position));
  const [current] = row.assessment.currentVersionId
    ? await db
        .select()
        .from(assessmentVersion)
        .where(eq(assessmentVersion.id, row.assessment.currentVersionId))
    : [];
  const snapshot = snapshotOf(row.assessment, pool, row.creator);
  return {
    status: row.assessment.status,
    problems: publishProblems(row.assessment, pool, row.creator),
    snapshot,
    version: current?.number ?? 0,
    // Publishing an unchanged Assessment would only duplicate its Version.
    changed: !current || JSON.stringify(current.snapshot) !== JSON.stringify(snapshot),
  };
}

/** Freezes the working copy into a new Assessment Version and makes it current. */
export async function publish(db: Db, assessmentId: string, creatorId: string) {
  return db.transaction(async (tx) => {
    const state = await publishState(tx, assessmentId, creatorId);
    if (!state || state.problems.length || !state.changed) return null;
    const [{ last }] = await tx
      .select({ last: max(assessmentVersion.number) })
      .from(assessmentVersion)
      .where(eq(assessmentVersion.assessmentId, assessmentId));
    const id = uuidv7();
    const number = (last ?? 0) + 1;
    await tx.insert(assessmentVersion).values({
      id,
      assessmentId,
      number,
      publishedAt: new Date(),
      snapshot: state.snapshot,
    });
    // A Closed Assessment stays Closed: a new Version doesn't reopen it to Learners.
    const status = state.status === "draft" ? "published" : state.status;
    await tx
      .update(assessment)
      .set({ currentVersionId: id, status })
      .where(eq(assessment.id, assessmentId));
    return number;
  });
}
