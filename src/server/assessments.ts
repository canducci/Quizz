import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assessment, assessmentVersion, question } from "@/db/schema";

/** The Creator's own Assessment, or null. Ids from the browser are never trusted. */
export async function ownAssessment(id: string, creatorId: string) {
  const [row] = await db
    .select()
    .from(assessment)
    .where(and(eq(assessment.id, id), eq(assessment.creatorId, creatorId)));
  return row ?? null;
}

/** The Question Pool in order, without deleted Questions. */
export function questionPool(assessmentId: string) {
  return db
    .select({
      id: question.id,
      type: question.type,
      text: question.text,
      options: question.options,
      keepOrder: question.keepOrder,
    })
    .from(question)
    .where(and(eq(question.assessmentId, assessmentId), isNull(question.deletedAt)))
    .orderBy(asc(question.position));
}

/** The Creator's Assessments, newest first. */
export function creatorAssessments(creatorId: string) {
  return db
    .select()
    .from(assessment)
    .where(eq(assessment.creatorId, creatorId))
    .orderBy(desc(assessment.createdAt));
}

/** What a Learner sees: the status and the current Version, or null for a Draft or unknown id. */
export async function learnerAssessment(id: string) {
  const [row] = await db
    .select({ status: assessment.status, snapshot: assessmentVersion.snapshot })
    .from(assessment)
    .innerJoin(assessmentVersion, eq(assessment.currentVersionId, assessmentVersion.id))
    .where(eq(assessment.id, id));
  return row && row.status !== "draft" ? row : null;
}
