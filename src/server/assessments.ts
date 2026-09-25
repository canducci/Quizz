import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assessment, question } from "@/db/schema";

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
