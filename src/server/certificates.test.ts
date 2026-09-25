import { expect, it } from "vitest";
import * as schema from "../db/schema";
import {
  correctName,
  creatorCertificates,
  eraseLearner,
  learnerCertificates,
  publicCertificate,
  revokeCertificate,
} from "./certificates";
import { addInvites } from "./invites";
import { requestCode } from "./one-time-code";
import { emailHash } from "./email-hash";
import { at, pass, published } from "./test-db";

const SECRET = "test-secret";
const ana = emailHash("ana@example.test", SECRET);

it("finds the Creator's own Certificates by id, URL or the Learner's email, and nobody else's", async () => {
  const { db } = await published();
  const cert = await pass(db, ana);
  await pass(db, "bia");
  // Another Creator's Certificate for the same Learner stays out of reach.
  await db.insert(schema.creator).values({ id: "c2", name: "Rival", joinedAt: new Date() });
  await db.insert(schema.certificate).values({
    ...cert,
    id: "other",
    publicId: "0000000000000000",
    creatorId: "c2",
  });

  const find = (typed: string, creator = "c1") => creatorCertificates(db, creator, typed, SECRET);
  const dashed = cert.publicId.match(/.{4}/g)!.join("-");
  for (const typed of [
    cert.publicId,
    dashed.toLowerCase(),
    `https://quizz.example/c/${dashed}`,
    " ANA@example.test ",
  ])
    expect((await find(typed))?.map((c) => c.publicId)).toEqual([cert.publicId]);
  expect(await find("0000-0000-0000-0000")).toEqual([]);
  expect(await find("nobody@example.test")).toEqual([]);
  expect(await find("not an id")).toBeNull();
  expect((await find("ana@example.test", "c2"))?.map((c) => c.publicId)).toEqual([
    "0000000000000000",
  ]);
});

it("revokes once with a private reason, counting it on the Revocation's day", async () => {
  const { db, stats } = await published();
  const cert = await pass(db, ana);
  const revoke = (reason: string, creatorId = "c1", now = at(60 * 24)) =>
    revokeCertificate(db, { creatorId, publicId: cert.publicId, reason, now });

  expect(await revoke("   ")).toBe(false);
  expect(await revoke("Shared answers", "c2")).toBe(false);
  expect(await revoke(" Shared answers ")).toBe(true);
  expect(await revoke("Again", "c1", at(60 * 48))).toBe(false);

  const [found] = (await creatorCertificates(db, "c1", cert.publicId, SECRET))!;
  expect(found).toMatchObject({
    status: "revoked",
    statusAt: at(60 * 24),
    revocationReason: "Shared answers",
  });
  const days = await db.select().from(schema.statsDay).orderBy(schema.statsDay.day);
  expect(days.map((d) => [d.day, d.revoked])).toEqual([
    ["2026-09-25", 0],
    ["2026-09-26", 1],
  ]);
  expect((await stats()).certificatesIssued).toBe(1);

  // The Verification Page's query never reads the reason.
  const shown = await publicCertificate(db, cert.publicId);
  expect(shown).toMatchObject({ status: "revoked", statusAt: at(60 * 24) });
  expect(JSON.stringify(shown)).not.toContain("Shared answers");
  expect(shown).not.toHaveProperty("revocationReason");
});

it("lists a Learner's Certificates across Creators, without Revocation reasons", async () => {
  const { db } = await published();
  const cert = await pass(db, ana);
  await pass(db, "bia");
  await db.insert(schema.creator).values({ id: "c2", name: "Rival", joinedAt: new Date() });
  await db
    .insert(schema.certificate)
    .values({ ...cert, id: "other", publicId: "0000000000000000", creatorId: "c2" });
  await revokeCertificate(db, { creatorId: "c1", publicId: cert.publicId, reason: "Cheating" });

  const mine = await learnerCertificates(db, ana);
  expect(mine.map((c) => [c.publicId, c.status]).sort()).toEqual([
    ["0000000000000000", "valid"],
    [cert.publicId, "revoked"],
  ]);
  expect(mine[0]).not.toHaveProperty("revocationReason");
  expect(mine[0]).not.toHaveProperty("replacedById");
  expect(JSON.stringify(mine)).not.toContain("Cheating");
});

it("corrects a name by replacing the Certificate: a new id, same Expiry, not counted as revoked", async () => {
  const { db, stats } = await published(30);
  const old = await pass(db, ana);
  const correct = (publicId: string, name: string, learner = ana) =>
    correctName(db, { learner, publicId, name, now: at(60) });

  expect(await correct(old.publicId, "  ")).toEqual({ ok: false, reason: "name" });
  expect(await correct(old.publicId, "Ana Souza", "bia")).toEqual({ ok: false, reason: "invalid" });
  const done = await correct(old.publicId, " Ana Souza ");
  expect(done).toMatchObject({ ok: true, version: { number: 1 } });
  const fresh = done.ok ? done.certificate : null!;
  expect(fresh).toMatchObject({
    holderName: "Ana Souza",
    emailHash: ana,
    score: old.score,
    versionId: old.versionId,
    creatorId: old.creatorId,
    issuedAt: at(60),
    expiresAt: old.expiresAt, // a correction never renews
    status: "valid",
  });
  expect(fresh.publicId).not.toBe(old.publicId);
  expect(await publicCertificate(db, old.publicId)).toMatchObject({
    status: "replaced",
    statusAt: at(60),
  });
  const [stored] = (await creatorCertificates(db, "c1", old.publicId, SECRET))!;
  expect(stored.revocationReason).toBe("Name correction");
  // Already replaced: nothing more to correct.
  expect(await correct(old.publicId, "Ana")).toEqual({ ok: false, reason: "invalid" });
  // An expired one can't be corrected either.
  expect(
    await correctName(db, {
      learner: ana,
      publicId: fresh.publicId,
      name: "A",
      now: at(60 * 24 * 31),
    }),
  ).toEqual({ ok: false, reason: "invalid" });

  expect(await stats()).toMatchObject({ revoked: 0, certificatesIssued: 2, passed: 1 });
});

it("erases a Learner's rows everywhere, leaving statistics and other Learners alone", async () => {
  const { db } = await published();
  const email = "ana@example.test";
  await pass(db, ana);
  await pass(db, "bia");
  await addInvites(db, "a1", [email, "bia@example.test"], SECRET);
  await requestCode(db, { email, ip: "1", purpose: "my-certificates", cap: 10, secret: SECRET });
  const before = await db.select().from(schema.statsDay);

  await eraseLearner(db, ana);
  const left = async (
    table:
      | typeof schema.attempt
      | typeof schema.certificate
      | typeof schema.invite
      | typeof schema.oneTimeCode,
  ) => (await db.select().from(table)).filter((r) => r.emailHash === ana).length;
  for (const table of [schema.attempt, schema.certificate, schema.invite, schema.oneTimeCode])
    expect(await left(table)).toBe(0);
  expect(await learnerCertificates(db, "bia")).toHaveLength(1);
  expect((await db.select().from(schema.invite)).length).toBe(1);
  expect(await db.select().from(schema.statsDay)).toEqual(before);
});
