import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { expect, it } from "vitest";
import { migrateDatabase } from "../db/migrate";
import * as schema from "../db/schema";
import { latestAttempt, retakeCheck, saveAnswer, startAttempt, submitAttempt } from "./attempts";
import { learnerCertificate } from "./certificates";
import { publish } from "./publish";

const MINUTE = 60_000;
const at = (minutes: number) => new Date(Date.UTC(2026, 8, 25, 12) + minutes * MINUTE);

/** A published Assessment "a1": 3 of 3 single-answer Questions, option 0 right, 10 minutes, 67% to pass. */
async function published(expiryDays: number | null = null) {
  const client = createClient({
    url: `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  });
  const db = drizzle(client, { schema });
  await migrateDatabase(client, db);
  await db.insert(schema.creator).values({
    id: "c1",
    name: "Ana",
    joinedAt: new Date(),
    logoKey: "logo",
    signerName: "Ana",
    signatureKey: "sig",
  });
  await db.insert(schema.assessment).values({
    id: "a1",
    creatorId: "c1",
    title: "T",
    createdAt: new Date(),
    drawn: 3,
    passingScore: 67,
    timeLimit: 10,
    expiryDays,
  });
  await db.insert(schema.question).values(
    ["q1", "q2", "q3"].map((id, i) => ({
      id,
      assessmentId: "a1",
      position: i,
      type: "single" as const,
      text: id,
      options: [
        { text: "right", correct: true },
        { text: "wrong", correct: false },
      ],
      keepOrder: false,
    })),
  );
  await publish(db, "a1", "c1");
  const stats = async () => (await db.select().from(schema.statsDay))[0];
  return { db, stats };
}

const learner = { assessmentId: "a1", learner: "hash-ana" };

it("starts once, resumes the same Attempt, and passes on the right answers", async () => {
  const { db, stats } = await published();
  const first = await startAttempt(db, { ...learner, now: at(0) });
  const started = first.ok ? first.attempt : null;
  expect(started?.drawn.map((d) => d.id).sort()).toEqual(["q1", "q2", "q3"]);
  expect(started?.deadline).toEqual(at(10));
  expect(await startAttempt(db, { ...learner, now: at(5) })).toEqual({
    ok: true,
    attempt: started,
  });

  for (const id of ["q1", "q2", "q3"])
    expect(await saveAnswer(db, { ...learner, questionId: id, choice: [0], now: at(1) })).toBe(
      true,
    );
  // Unknown Question, malformed choice.
  expect(await saveAnswer(db, { ...learner, questionId: "qx", choice: [0], now: at(1) })).toBe(
    false,
  );
  expect(await saveAnswer(db, { ...learner, questionId: "q1", choice: [0, 1], now: at(1) })).toBe(
    false,
  );
  const resumed = await latestAttempt(db, "a1", "hash-ana", at(2));
  expect(resumed?.attempt.answers).toEqual({ q1: [0], q2: [0], q3: [0] });

  expect(await submitAttempt(db, { ...learner, name: "  ", now: at(3) })).toEqual({
    ok: false,
    reason: "name",
  });
  const passed = await submitAttempt(db, { ...learner, name: " Ana Souza ", now: at(3) });
  expect(passed).toMatchObject({ ok: true, score: 100, passed: true });
  const [issued] = await db.select().from(schema.certificate);
  expect(passed.ok && passed.certificate).toEqual(issued);
  expect(issued).toMatchObject({
    creatorId: "c1",
    emailHash: "hash-ana",
    holderName: "Ana Souza",
    score: 100,
    issuedAt: at(3),
    expiresAt: null,
    status: "valid",
  });
  expect(issued.publicId).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
  expect(passed.ok && passed.version.number).toBe(1);
  expect(await learnerCertificate(db, "a1", "hash-ana")).toMatchObject({
    certificate: issued,
    version: { number: 1 },
  });
  expect(await learnerCertificate(db, "a1", "hash-bob")).toBeNull();
  expect(await submitAttempt(db, { ...learner, name: "Ana Souza", now: at(3) })).toEqual({
    ok: false,
    reason: "over",
  });
  expect(await saveAnswer(db, { ...learner, questionId: "q1", choice: [1], now: at(4) })).toBe(
    false,
  );
  expect((await latestAttempt(db, "a1", "hash-ana", at(4)))?.attempt).toMatchObject({
    outcome: "submitted",
    score: 100,
    passed: true,
  });

  expect(await stats()).toMatchObject({
    day: "2026-09-25",
    attempts: 1,
    submitted: 1,
    passed: 1,
    certificatesIssued: 1,
    timedOut: 0,
    scoreHistogram: { "100": 1 },
    timeHistogram: { "3": 1 },
    questions: {
      q1: { shown: 1, correct: 1 },
      q2: { shown: 1, correct: 1 },
      q3: { shown: 1, correct: 1 },
    },
  });
});

it("fails below the Passing Score, showing only score and pass/fail", async () => {
  const { db, stats } = await published();
  await startAttempt(db, { ...learner, now: at(0) });
  await saveAnswer(db, { ...learner, questionId: "q1", choice: [0], now: at(1) });
  await saveAnswer(db, { ...learner, questionId: "q2", choice: [0], now: at(1) });
  await saveAnswer(db, { ...learner, questionId: "q3", choice: [1], now: at(1) });
  expect(await submitAttempt(db, { ...learner, name: "Ana", now: at(9) })).toMatchObject({
    ok: true,
    score: 66,
    passed: false,
    certificate: null,
  });
  // The name is discarded with the fail.
  expect(await db.select().from(schema.certificate)).toEqual([]);
  expect(await stats()).toMatchObject({
    attempts: 1,
    submitted: 1,
    passed: 0,
    certificatesIssued: 0,
    scoreHistogram: { "66": 1 },
    questions: { q3: { shown: 1, correct: 0 } },
  });
});

it("refuses a submit after the deadline and counts the Timed out Attempt once, on its deadline's day", async () => {
  const { db, stats } = await published();
  // Starts 5 minutes before midnight, so the deadline falls on the next UTC day.
  const start = new Date(Date.UTC(2026, 8, 25, 23, 55));
  const late = new Date(Date.UTC(2026, 8, 27));
  await startAttempt(db, { ...learner, now: start });
  expect(await saveAnswer(db, { ...learner, questionId: "q1", choice: [0], now: late })).toBe(
    false,
  );
  expect(await submitAttempt(db, { ...learner, name: "Ana", now: late })).toEqual({
    ok: false,
    reason: "timedOut",
  });
  expect((await latestAttempt(db, "a1", "hash-ana", late))?.attempt.outcome).toBe("timed_out");
  const days = await db.select().from(schema.statsDay);
  expect(days.map((d) => [d.day, d.attempts, d.timedOut]).sort()).toEqual([
    ["2026-09-25", 1, 0],
    ["2026-09-26", 0, 1],
  ]);
  // A new Attempt can start once the old one is over and its cooldown has run.
  const next = await startAttempt(db, { ...learner, now: late });
  expect(next.ok && next.attempt.outcome).toBe("in_progress");
  expect((await stats()).attempts).toBe(1);
});

it("starts nothing on a Closed Assessment, but lets a running Attempt finish", async () => {
  const { db } = await published();
  await startAttempt(db, { ...learner, now: at(0) });
  await db.update(schema.assessment).set({ status: "closed" });
  expect(await startAttempt(db, { ...learner, learner: "hash-bob", now: at(1) })).toEqual({
    ok: false,
    block: { reason: "closed" },
  });
  expect(await submitAttempt(db, { ...learner, name: "Ana", now: at(2) })).toMatchObject({
    ok: true,
  });
});

it("tells a late Learner time ran out, even without a name", async () => {
  const { db } = await published();
  await startAttempt(db, { ...learner, now: at(0) });
  expect(await submitAttempt(db, { ...learner, name: "", now: at(11) })).toEqual({
    ok: false,
    reason: "timedOut",
  });
});

it("sets a pass's Expiry from the Version's settings", async () => {
  const { db } = await published(365);
  await startAttempt(db, { ...learner, now: at(0) });
  for (const id of ["q1", "q2", "q3"])
    await saveAnswer(db, { ...learner, questionId: id, choice: [0], now: at(1) });
  const done = await submitAttempt(db, { ...learner, name: "Ana", now: at(2) });
  expect(done.ok && done.certificate?.expiresAt).toEqual(
    new Date(at(2).getTime() + 365 * 86_400_000),
  );
});

it("enforces the Retake Policy on start, and counts no refused start", async () => {
  const { db } = await published(1);
  const pass = async (right: boolean, now: Date) => {
    for (const id of ["q1", "q2", "q3"])
      await saveAnswer(db, { ...learner, questionId: id, choice: [right ? 0 : 1], now });
    return submitAttempt(db, { ...learner, name: "Ana", now });
  };
  await startAttempt(db, { ...learner, now: at(0) });
  await pass(false, at(5));
  // Default rules: 2 Attempts, 60 minutes apart.
  expect(await startAttempt(db, { ...learner, now: at(30) })).toEqual({
    ok: false,
    block: { reason: "cooldown", until: at(65) },
  });
  expect(await retakeCheck(db, "a1", "hash-ana", { maxAttempts: 2, cooldown: 60 }, at(30))).toEqual(
    { reason: "cooldown", until: at(65) },
  );
  expect((await startAttempt(db, { ...learner, now: at(65) })).ok).toBe(true);
  const done = await pass(true, at(70));
  const publicId = done.ok && done.certificate!.publicId;
  const expiresAt = new Date(at(70).getTime() + 86_400_000);
  expect(await startAttempt(db, { ...learner, now: at(200) })).toEqual({
    ok: false,
    block: { reason: "certificate", publicId, expiresAt },
  });
  // Expired: the count starts again.
  expect((await startAttempt(db, { ...learner, now: expiresAt })).ok).toBe(true);
  const days = await db.select().from(schema.statsDay);
  expect(days.reduce((n, d) => n + d.attempts, 0)).toBe(3);
});
