import { expect, it } from "vitest";
import * as schema from "../db/schema";
import { creatorCertificates, publicCertificate, revokeCertificate } from "./certificates";
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
