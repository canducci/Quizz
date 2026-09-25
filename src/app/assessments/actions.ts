"use server";

import { and, eq, isNull, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { assessment, question } from "@/db/schema";
import { normalizeQuestion, type QuestionContent, type QuestionType } from "@/domain/question";
import { currentCreator } from "@/server/auth";
import { ownAssessment } from "@/server/assessments";
import { putImage, type UploadResult } from "@/server/files";

export type StoredQuestion = QuestionContent & { id: string };

async function me() {
  const creator = await currentCreator();
  if (!creator) redirect("/");
  return creator;
}

async function ownQuestion(id: string) {
  const [row] = await db
    .select({ id: question.id })
    .from(question)
    .innerJoin(assessment, eq(question.assessmentId, assessment.id))
    .where(
      and(
        eq(question.id, id),
        isNull(question.deletedAt),
        eq(assessment.creatorId, (await me()).id),
      ),
    );
  return row ?? null;
}

export async function createAssessment(form: FormData) {
  const creator = await me();
  const title = String(form.get("title") ?? "").trim();
  if (!title || title.length > 200) return;
  const id = uuidv7();
  await db.insert(assessment).values({ id, creatorId: creator.id, title, createdAt: new Date() });
  redirect(`/assessments/${id}`);
}

export async function addQuestion(
  assessmentId: string,
  type: QuestionType,
): Promise<StoredQuestion | null> {
  const added = normalizeQuestion({
    type,
    text: "",
    options: [0, 1].map(() => ({ text: "", correct: false })),
    keepOrder: false,
  });
  if (!added || !(await ownAssessment(assessmentId, (await me()).id))) return null;
  const stored = { id: uuidv7(), ...added };
  await db.transaction(async (tx) => {
    const [{ last }] = await tx
      .select({ last: max(question.position) })
      .from(question)
      .where(eq(question.assessmentId, assessmentId));
    await tx.insert(question).values({ ...stored, assessmentId, position: (last ?? 0) + 1 });
  });
  return stored;
}

export async function saveQuestion(id: string, input: unknown): Promise<boolean> {
  const content = normalizeQuestion(input);
  if (!content || !(await ownQuestion(id))) return false;
  await db.update(question).set(content).where(eq(question.id, id));
  return true;
}

export async function deleteQuestion(id: string) {
  if (!(await ownQuestion(id))) return;
  await db.update(question).set({ deletedAt: new Date() }).where(eq(question.id, id));
}

export async function uploadQuestionImage(form: FormData): Promise<UploadResult> {
  await me();
  const file = form.get("image");
  if (!(file instanceof File)) return { error: "badImage" };
  return putImage(file);
}
