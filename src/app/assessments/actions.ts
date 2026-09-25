"use server";

import { and, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { assessment, question } from "@/db/schema";
import { parseAccess, parseRules } from "@/domain/settings";
import { normalizeQuestion, type QuestionContent, type QuestionType } from "@/domain/question";
import { requireCreator } from "@/server/auth";
import { ownAssessment } from "@/server/assessments";
import { parseEmailList } from "@/server/email-hash";
import { addInvites, removeInvites } from "@/server/invites";
import { toLocale } from "@/i18n/locales";
import { putImage, type UploadResult } from "@/server/files";

export type StoredQuestion = QuestionContent & { id: string };

async function ownQuestion(id: string) {
  const [row] = await db
    .select({ id: question.id })
    .from(question)
    .innerJoin(assessment, eq(question.assessmentId, assessment.id))
    .where(
      and(
        eq(question.id, id),
        isNull(question.deletedAt),
        eq(assessment.creatorId, (await requireCreator()).id),
      ),
    );
  return row ?? null;
}

export async function createAssessment(form: FormData) {
  const creator = await requireCreator();
  const title = String(form.get("title") ?? "").trim();
  if (!title || title.length > 200) return;
  const id = uuidv7();
  await db.insert(assessment).values({
    id,
    creatorId: creator.id,
    title,
    createdAt: new Date(),
    language: toLocale(await getLocale()),
  });
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
  if (!added || !(await ownAssessment(assessmentId, (await requireCreator()).id))) return null;
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

export async function deleteQuestion(id: string): Promise<boolean> {
  if (!(await ownQuestion(id))) return false;
  await db.update(question).set({ deletedAt: new Date() }).where(eq(question.id, id));
  return true;
}

export async function uploadQuestionImage(form: FormData): Promise<UploadResult> {
  await requireCreator();
  const file = form.get("image");
  if (!(file instanceof File)) return { error: "badImage" };
  return putImage(file);
}

export type SettingsState = { status: "idle" | "saved" | "invalid" };

async function saveSettings(assessmentId: string, settings: object | null): Promise<SettingsState> {
  if (!settings || !(await ownAssessment(assessmentId, (await requireCreator()).id))) {
    return { status: "invalid" };
  }
  await db.update(assessment).set(settings).where(eq(assessment.id, assessmentId));
  revalidatePath(`/assessments/${assessmentId}`);
  return { status: "saved" };
}

export async function saveRules(assessmentId: string, _: SettingsState, form: FormData) {
  return saveSettings(assessmentId, parseRules(form));
}

export async function saveAccess(assessmentId: string, _: SettingsState, form: FormData) {
  return saveSettings(assessmentId, parseAccess(form));
}

export type InviteState =
  { status: "idle" } | { status: "added" | "removed"; changed: number; invalid: number };

/** Adds or removes the pasted emails at once; only their hashes are stored. */
export async function changeInvites(
  assessmentId: string,
  _: InviteState,
  form: FormData,
): Promise<InviteState> {
  if (!(await ownAssessment(assessmentId, (await requireCreator()).id))) return { status: "idle" };
  const { emails, invalid } = parseEmailList(String(form.get("emails") ?? ""));
  const remove = form.get("op") === "remove";
  const changed = await (remove ? removeInvites : addInvites)(db, assessmentId, emails);
  revalidatePath(`/assessments/${assessmentId}`);
  return { status: remove ? "removed" : "added", changed, invalid };
}
