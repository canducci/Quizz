import { and, desc, eq, ne, sql } from "drizzle-orm";
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
import { expiryOf, newPublicId } from "../domain/certificate";
import type { CertificateVersion } from "../domain/certificate";
import { retakeBlock, type RetakeBlock } from "../domain/retake";
import type { Rules } from "../domain/settings";
import { utcDay } from "./one-time-code";

type Db = LibSQLDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Attempt = typeof schema.attempt.$inferSelect;
type Certificate = typeof schema.certificate.$inferSelect;
type Counter =
  "attempts" | "timedOut" | "submitted" | "passed" | "certificatesIssued" | "revoked" | "expired";
type Tallies = Pick<
  typeof schema.statsDay.$inferSelect,
  "scoreHistogram" | "timeHistogram" | "questions"
>;
const { assessment, assessmentVersion, attempt, certificate, creator, statsDay } = schema;

/** Adds one to each counter for the Version's day. The counter write comes first, so it holds the
 * row (and SQLite's write lock) before `tallies` reads and rewrites the JSON columns. */
export async function bump(
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

/** Marks a running Attempt Timed out, counted once on its deadline's day. The hourly sweep reuses it. */
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
    .select({ attempt, snapshot: assessmentVersion.snapshot, number: assessmentVersion.number })
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

/** Why the Retake Policy refuses the Learner a new Attempt, or null. `rules` are the current
 * Version's. Call it after `running` or `latestAttempt`, so an overdue Attempt counts as Timed out. */
export async function retakeCheck(
  tx: Tx | Db,
  assessmentId: string,
  learner: string,
  rules: Pick<Rules, "maxAttempts" | "cooldown">,
  now: Date,
) {
  const attempts = await tx
    .select({
      startedAt: attempt.startedAt,
      deadline: attempt.deadline,
      submittedAt: attempt.submittedAt,
    })
    .from(attempt)
    .where(
      and(
        eq(attempt.assessmentId, assessmentId),
        eq(attempt.emailHash, learner),
        ne(attempt.outcome, "in_progress"),
      ),
    );
  const certificates = await tx
    .select({
      publicId: certificate.publicId,
      status: certificate.status,
      statusAt: certificate.statusAt,
      expiresAt: certificate.expiresAt,
    })
    .from(certificate)
    .innerJoin(assessmentVersion, eq(certificate.versionId, assessmentVersion.id))
    .where(
      and(eq(assessmentVersion.assessmentId, assessmentId), eq(certificate.emailHash, learner)),
    );
  return retakeBlock(attempts, certificates, rules, now);
}

export type StartResult =
  { ok: true; attempt: Attempt } | { ok: false; block: RetakeBlock | { reason: "closed" } };

/** Resumes the Learner's running Attempt or starts one on the current Version, if the Assessment
 * is open and the Retake Policy allows. The caller has already checked the Invite-only list. */
export async function startAttempt(
  db: Db,
  opts: { assessmentId: string; learner: string; now?: Date; random?: () => number },
): Promise<StartResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const resumed = await running(tx, opts.assessmentId, opts.learner, now);
    if (resumed) return { ok: true, attempt: resumed.attempt };
    const [open] = await tx
      .select({
        status: assessment.status,
        versionId: assessmentVersion.id,
        snapshot: assessmentVersion.snapshot,
      })
      .from(assessment)
      .innerJoin(assessmentVersion, eq(assessment.currentVersionId, assessmentVersion.id))
      .where(eq(assessment.id, opts.assessmentId));
    if (open?.status !== "published") return { ok: false, block: { reason: "closed" } };
    const { settings, questions } = open.snapshot;
    const block = await retakeCheck(tx, opts.assessmentId, opts.learner, settings, now);
    if (block) return { ok: false, block };
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
    return { ok: true, attempt: row };
  });
}

/** Saves one Question's whole choice. False once the Attempt is over or the answer is malformed. */
export async function saveAnswer(
  db: Db,
  opts: { assessmentId: string; learner: string; questionId: string; choice: unknown; now?: Date },
) {
  const now = opts.now ?? new Date();
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
  | {
      ok: true;
      score: number;
      passed: boolean;
      certificate: Certificate | null;
      /** The Attempt's own Version, which the Certificate renders from. */
      version: CertificateVersion;
    }
  | { ok: false; reason: "name" | "timedOut" | "over" };

/** Scores the running Attempt; a pass issues the Certificate in the same transaction. Refused past
 * the deadline, which times it out instead. `name` is what a pass puts on the Certificate; a fail
 * discards it. */
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
    const [issuer] = await tx
      .select({ id: creator.id, bannedAt: creator.bannedAt })
      .from(assessment)
      .innerJoin(creator, eq(assessment.creatorId, creator.id))
      .where(eq(assessment.id, opts.assessmentId));
    // A Creator Ban revokes every Certificate, so one running Attempt can't earn a new one.
    if (issuer.bannedAt) return { ok: false, reason: "over" };
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
    await bump(
      tx,
      versionId,
      now,
      passed ? ["submitted", "passed", "certificatesIssued"] : ["submitted"],
      (s) => ({
        scoreHistogram: histogram(s.scoreHistogram, score),
        timeHistogram: histogram(s.timeHistogram, minutesTaken(startedAt, now)),
        questions: tally(s.questions, drawn, correct),
      }),
    );
    const version = { number: row.number, snapshot: row.snapshot };
    if (!passed) return { ok: true, score, passed, certificate: null, version };
    const [issued] = await tx
      .insert(certificate)
      .values({
        id: uuidv7(),
        publicId: newPublicId(),
        versionId,
        creatorId: issuer.id,
        emailHash: opts.learner,
        holderName: name,
        score,
        issuedAt: now,
        expiresAt: expiryOf(now, settings.expiryDays),
      })
      .returning();
    return { ok: true, score, passed, certificate: issued, version };
  });
}
