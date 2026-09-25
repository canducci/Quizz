import { and, desc, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { v7 as uuidv7 } from "uuid";
import * as schema from "../db/schema";
import {
  MAX_NAME,
  cleanChoice,
  deadlineOf,
  draw,
  histogram,
  isOverdue,
  minutesTaken,
  scoreAttempt,
  tally,
} from "../domain/attempt";
import { utcDay } from "./one-time-code";

type Db = LibSQLDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Attempt = typeof schema.attempt.$inferSelect;
type Counter = "attempts" | "timedOut" | "submitted" | "passed";
type Tallies = Pick<
  typeof schema.statsDay.$inferSelect,
  "scoreHistogram" | "timeHistogram" | "questions"
>;
const { assessment, assessmentVersion, attempt, statsDay } = schema;

/** Adds one to each counter for the Version's day. The counter write comes first, so it holds the
 * row (and SQLite's write lock) before `tallies` reads and rewrites the JSON columns. */
async function bump(
  tx: Tx,
  versionId: string,
  day: Date,
  counters: Counter[],
  tallies?: (row: Tallies) => Partial<Tallies>,
) {
  const key = { versionId, day: utcDay(day) };
  const plusOne = Object.fromEntries(counters.map((c) => [c, sql`${statsDay[c]} + 1`]));
  await tx
    .insert(statsDay)
    .values({ ...key, ...Object.fromEntries(counters.map((c) => [c, 1])) })
    .onConflictDoUpdate({ target: [statsDay.versionId, statsDay.day], set: plusOne });
  if (!tallies) return;
  const where = and(eq(statsDay.versionId, versionId), eq(statsDay.day, key.day));
  const [row] = await tx.select().from(statsDay).where(where);
  await tx.update(statsDay).set(tallies(row)).where(where);
}

/** Marks a running Attempt Timed out, counted once on its deadline's day. The hourly sweep (ticket 12) must reuse it. */
export async function timeOut(tx: Tx, row: Attempt) {
  const done = await tx
    .update(attempt)
    .set({ outcome: "timed_out" })
    .where(and(eq(attempt.id, row.id), eq(attempt.outcome, "in_progress")));
  if (done.rowsAffected === 1) await bump(tx, row.versionId, row.deadline, ["timedOut"]);
}

/** The Learner's running Attempt with its Version snapshot, timing it out if it's overdue. */
async function running(tx: Tx, assessmentId: string, learner: string, now: Date) {
  const [row] = await tx
    .select({ attempt, snapshot: assessmentVersion.snapshot })
    .from(attempt)
    .innerJoin(assessmentVersion, eq(attempt.versionId, assessmentVersion.id))
    .where(
      and(
        eq(attempt.assessmentId, assessmentId),
        eq(attempt.emailHash, learner),
        eq(attempt.outcome, "in_progress"),
      ),
    );
  if (!row) return null;
  if (isOverdue(row.attempt.deadline, now)) {
    await timeOut(tx, row.attempt);
    return null;
  }
  return row;
}

/** The Learner's latest Attempt on the Assessment with its Version snapshot, or null. An overdue
 * one is Timed out as it's read. `learner` is the email hash. */
export async function latestAttempt(
  db: Db,
  assessmentId: string,
  learner: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await running(tx, assessmentId, learner, now);
    return latest(tx, assessmentId, learner);
  });
}

async function latest(tx: Tx, assessmentId: string, learner: string) {
  const [row] = await tx
    .select({ attempt, snapshot: assessmentVersion.snapshot })
    .from(attempt)
    .innerJoin(assessmentVersion, eq(attempt.versionId, assessmentVersion.id))
    .where(and(eq(attempt.assessmentId, assessmentId), eq(attempt.emailHash, learner)))
    .orderBy(desc(attempt.startedAt), desc(attempt.id))
    .limit(1);
  return row ?? null;
}

/** Resumes the Learner's running Attempt or starts one on the current Version. Null when the
 * Assessment isn't open. The caller has already checked the Invite-only list. */
export async function startAttempt(
  db: Db,
  opts: { assessmentId: string; learner: string; now?: Date; random?: () => number },
) {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const resumed = await running(tx, opts.assessmentId, opts.learner, now);
    if (resumed) return resumed.attempt;
    const [open] = await tx
      .select({
        status: assessment.status,
        versionId: assessmentVersion.id,
        snapshot: assessmentVersion.snapshot,
      })
      .from(assessment)
      .innerJoin(assessmentVersion, eq(assessment.currentVersionId, assessmentVersion.id))
      .where(eq(assessment.id, opts.assessmentId));
    if (open?.status !== "published") return null;
    const { settings, questions } = open.snapshot;
    const row: Attempt = {
      id: uuidv7(),
      assessmentId: opts.assessmentId,
      versionId: open.versionId,
      emailHash: opts.learner,
      startedAt: now,
      deadline: deadlineOf(now, settings.timeLimit),
      drawn: draw(questions, settings.drawn, opts.random),
      answers: {},
      submittedAt: null,
      outcome: "in_progress",
      score: null,
      passed: null,
    };
    await tx.insert(attempt).values(row);
    await bump(tx, open.versionId, now, ["attempts"]);
    return row;
  });
}

/** Saves one Question's whole choice. False once the Attempt is over or the answer is malformed. */
export async function saveAnswer(
  db: Db,
  opts: { assessmentId: string; learner: string; questionId: string; choice: unknown; now?: Date },
) {
  const now = opts.now ?? new Date();
  // ponytail: read-modify-write of the answers JSON; a save racing another tab's save fails and the
  // client reports it. The client itself sends one save at a time.
  return db.transaction(async (tx) => {
    const row = await running(tx, opts.assessmentId, opts.learner, now);
    if (!row || !row.attempt.drawn.some((d) => d.id === opts.questionId)) return false;
    const question = row.snapshot.questions.find((q) => q.id === opts.questionId)!;
    const choice = cleanChoice(question, opts.choice);
    if (!choice) return false;
    const answers = { ...row.attempt.answers, [opts.questionId]: choice };
    await tx
      .update(attempt)
      .set({ answers })
      .where(and(eq(attempt.id, row.attempt.id), eq(attempt.outcome, "in_progress")));
    return true;
  });
}

export type SubmitResult =
  | { ok: true; score: number; passed: boolean }
  | { ok: false; reason: "name" | "timedOut" | "over" };

/** Scores the running Attempt. Refused past the deadline, which times it out instead. `name` is what
 * a pass puts on the Certificate; a fail discards it. */
export async function submitAttempt(
  db: Db,
  opts: { assessmentId: string; learner: string; name: string; now?: Date },
): Promise<SubmitResult> {
  const now = opts.now ?? new Date();
  const name = opts.name.trim();
  return db.transaction(async (tx) => {
    const row = await running(tx, opts.assessmentId, opts.learner, now);
    if (!row) {
      const last = await latest(tx, opts.assessmentId, opts.learner);
      return { ok: false, reason: last?.attempt.outcome === "timed_out" ? "timedOut" : "over" };
    }
    // After the deadline check, so a late Learner hears that time ran out.
    if (!name || name.length > MAX_NAME) return { ok: false, reason: "name" };
    const { drawn, answers, versionId, startedAt } = row.attempt;
    const { settings, questions } = row.snapshot;
    const { score, passed, correct } = scoreAttempt(
      questions,
      drawn,
      answers,
      settings.passingScore,
    );
    const done = await tx
      .update(attempt)
      .set({ outcome: "submitted", submittedAt: now, score, passed })
      .where(and(eq(attempt.id, row.attempt.id), eq(attempt.outcome, "in_progress")));
    if (done.rowsAffected !== 1) return { ok: false, reason: "over" };
    // Per-Question counts come from submitted Attempts only, so a Timed out one doesn't lower the
    // correct-answer rate of Questions nobody answered.
    await bump(tx, versionId, now, passed ? ["submitted", "passed"] : ["submitted"], (s) => ({
      scoreHistogram: histogram(s.scoreHistogram, score),
      timeHistogram: histogram(s.timeHistogram, minutesTaken(startedAt, now)),
      questions: tally(s.questions, drawn, correct),
    }));
    return { ok: true, score, passed };
  });
}
