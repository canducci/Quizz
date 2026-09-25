import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import * as schema from "../db/schema";
import { saveAnswer, startAttempt, submitAttempt } from "./attempts";
import { sweep } from "./sweep";
import { at, published } from "./test-db";

const DAY_MINUTES = 24 * 60;
const { attempt, certificate, emailDay, oneTimeCode, session, statsDay, user, verification } =
  schema;

/** Every row the sweep touches, to compare one run with the next. */
async function everything(db: Awaited<ReturnType<typeof published>>["db"]) {
  return Promise.all(
    [attempt, certificate, statsDay, oneTimeCode, emailDay, session, verification].map((t) =>
      db.select().from(t),
    ),
  );
}

it("times out overdue Attempts once, each on its deadline's day, after any downtime", async () => {
  const { db } = await published();
  // Two Learners abandon Attempts on different days; the app is down until the third day.
  await startAttempt(db, { assessmentId: "a1", learner: "ana", now: at(0) });
  await startAttempt(db, { assessmentId: "a1", learner: "bia", now: at(DAY_MINUTES) });
  // Still running at the sweep: left alone.
  await startAttempt(db, { assessmentId: "a1", learner: "cid", now: at(2 * DAY_MINUTES) });

  await sweep(db, at(2 * DAY_MINUTES + 5));
  const outcomes = await db
    .select({ learner: attempt.emailHash, outcome: attempt.outcome })
    .from(attempt);
  expect(outcomes.sort((a, b) => a.learner.localeCompare(b.learner))).toEqual([
    { learner: "ana", outcome: "timed_out" },
    { learner: "bia", outcome: "timed_out" },
    { learner: "cid", outcome: "in_progress" },
  ]);
  const days = await db.select({ day: statsDay.day, timedOut: statsDay.timedOut }).from(statsDay);
  expect(days.sort((a, b) => a.day.localeCompare(b.day))).toEqual([
    { day: "2026-09-25", timedOut: 1 },
    { day: "2026-09-26", timedOut: 1 },
    { day: "2026-09-27", timedOut: 0 },
  ]);

  const before = await everything(db);
  await sweep(db, at(2 * DAY_MINUTES + 6));
  expect(await everything(db)).toEqual(before);
});

it("counts a valid Certificate crossing Expiry once, on its expires_at day", async () => {
  const { db } = await published(1);
  for (const learner of ["ana", "bia"]) {
    await startAttempt(db, { assessmentId: "a1", learner, now: at(0) });
    for (const questionId of ["q1", "q2", "q3"])
      await saveAnswer(db, { assessmentId: "a1", learner, questionId, choice: [0], now: at(0) });
    await submitAttempt(db, { assessmentId: "a1", learner, name: learner, now: at(1) });
  }
  const [ana, bia] = await db.select().from(certificate).orderBy(certificate.emailHash);
  expect(ana.expiresAt).toEqual(at(DAY_MINUTES + 1));
  // A revoked Certificate's Expiry isn't counted: it already left the valid ones.
  await db.update(certificate).set({ status: "revoked" }).where(eq(certificate.id, bia.id));

  await sweep(db, at(DAY_MINUTES));
  expect((await db.select().from(certificate)).map((c) => c.expiryCountedAt)).toEqual([null, null]);

  // Swept days late: counted on the day it expired, not the day of the sweep.
  await sweep(db, at(3 * DAY_MINUTES));
  await sweep(db, at(4 * DAY_MINUTES));
  const [counted] = await db.select().from(certificate).where(eq(certificate.id, ana.id));
  expect(counted.expiryCountedAt).toEqual(at(3 * DAY_MINUTES));
  const days = await db.select({ day: statsDay.day, expired: statsDay.expired }).from(statsDay);
  expect(days.sort((a, b) => a.day.localeCompare(b.day))).toEqual([
    { day: "2026-09-25", expired: 0 },
    { day: "2026-09-26", expired: 1 },
  ]);
});

it("deletes old one-time codes, email counts, and expired sign-in sessions and tokens", async () => {
  const { db } = await published();
  const now = at(10 * DAY_MINUTES);
  const code = (id: string, createdAt: Date) => ({
    id,
    emailHash: "h",
    codeHash: "c",
    purpose: "attempt" as const,
    expiresAt: createdAt,
    createdAt,
    ip: "1.1.1.1",
  });
  await db
    .insert(oneTimeCode)
    .values([code("old", at(9 * DAY_MINUTES - 1)), code("new", at(9 * DAY_MINUTES))]);
  // Today is 2026-10-05: keep the last week, from 2026-09-28.
  await db.insert(emailDay).values([
    { day: "2026-09-27", sent: 1 },
    { day: "2026-09-28", sent: 1 },
  ]);
  await db.insert(user).values({ id: "u", name: "U", email: "u@x" });
  await db.insert(session).values([
    { id: "old", token: "a", userId: "u", expiresAt: now, updatedAt: now },
    { id: "new", token: "b", userId: "u", expiresAt: at(10 * DAY_MINUTES + 1), updatedAt: now },
  ]);
  await db.insert(verification).values([
    { id: "old", identifier: "i", value: "v", expiresAt: now },
    { id: "new", identifier: "i", value: "v", expiresAt: at(10 * DAY_MINUTES + 1) },
  ]);

  await sweep(db, now);
  const ids = async (t: typeof oneTimeCode | typeof session | typeof verification) =>
    (await db.select({ id: t.id }).from(t)).map((r) => r.id);
  expect(await ids(oneTimeCode)).toEqual(["new"]);
  expect(await ids(session)).toEqual(["new"]);
  expect(await ids(verification)).toEqual(["new"]);
  expect((await db.select().from(emailDay)).map((r) => r.day)).toEqual(["2026-09-28"]);
});
