import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import * as schema from "../db/schema";
import { publicCertificate, correctName } from "./certificates";
import { banCreator, deleteCreatorAccount } from "./creators";
import { startAttempt, submitAttempt } from "./attempts";
import { at, pass, published } from "./test-db";

/** "a1"'s Creator "c1" signed in as ana@creator.test. */
async function signedIn(expiryDays: number | null = null) {
  const { db, stats } = await published(expiryDays);
  await db.insert(schema.user).values({ id: "u1", name: "Ana", email: "ana@creator.test" });
  await db.update(schema.creator).set({ authUserId: "u1" }).where(eq(schema.creator.id, "c1"));
  await db
    .insert(schema.session)
    .values({ id: "s1", token: "t", userId: "u1", expiresAt: at(600), updatedAt: at(0) });
  return { db, stats };
}

const status = async (db: Awaited<ReturnType<typeof published>>["db"], publicId: string) =>
  (await publicCertificate(db, publicId))!.status;

it("a Creator Ban revokes every Valid Certificate once, closes the Assessments and signs them out", async () => {
  const { db, stats } = await signedIn(1);
  const valid = await pass(db, "ana");
  const expired = await pass(db, "bia", -2 * 24 * 60);
  const corrected = await pass(db, "caio");
  const fixed = await correctName(db, {
    learner: "caio",
    publicId: corrected.publicId,
    name: "Caio",
    now: at(2),
  });
  const before = (await stats())!.revoked;

  expect(await banCreator(db, " ANA@creator.test ", at(10))).toEqual({ revoked: 2 });
  expect(await status(db, valid.publicId)).toBe("revoked");
  expect(await status(db, fixed.ok ? fixed.certificate.publicId : "")).toBe("revoked");
  // Expired ones were already counted as expired; a replaced one isn't Valid.
  expect(await status(db, expired.publicId)).toBe("valid");
  expect(await status(db, corrected.publicId)).toBe("replaced");
  expect((await stats())!.revoked).toBe(before + 2);
  const [c1] = await db.select().from(schema.creator);
  expect(c1.bannedAt).toEqual(at(10));
  expect((await db.select().from(schema.assessment))[0].status).toBe("closed");
  expect(await db.select().from(schema.session)).toEqual([]);

  // Idempotent: nothing more is revoked or counted, and the ban keeps its date.
  expect(await banCreator(db, "ana@creator.test", at(20))).toEqual({ revoked: 0 });
  expect((await stats())!.revoked).toBe(before + 2);
  expect((await db.select().from(schema.creator))[0].bannedAt).toEqual(at(10));
});

it("an Attempt running when its Creator is banned earns no Certificate", async () => {
  const { db } = await signedIn();
  await startAttempt(db, { assessmentId: "a1", learner: "ana", now: at(0) });
  await banCreator(db, "ana@creator.test", at(1));
  const done = await submitAttempt(db, {
    assessmentId: "a1",
    learner: "ana",
    name: "Ana",
    now: at(2),
  });
  expect(done.ok).toBe(false);
  expect(await db.select().from(schema.certificate)).toEqual([]);
});

it("banning an unknown email finds no Creator", async () => {
  const { db } = await signedIn();
  expect(await banCreator(db, "nobody@creator.test")).toBeNull();
});

it("deleting a Creator account removes the login but keeps the profile and its Valid Certificates", async () => {
  const { db } = await signedIn();
  const cert = await pass(db, "ana");

  await deleteCreatorAccount(db, "u1");

  expect(await db.select().from(schema.user)).toEqual([]);
  expect(await db.select().from(schema.session)).toEqual([]);
  const [c1] = await db.select().from(schema.creator);
  expect(c1).toMatchObject({ id: "c1", name: "Ana", authUserId: null, bannedAt: null });
  expect(await status(db, cert.publicId)).toBe("valid");
});
