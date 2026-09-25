import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { expect, it } from "vitest";
import { migrateDatabase } from "../db/migrate";
import * as schema from "../db/schema";
import { publish, publishState } from "./publish";

it("freezes each Version and publishes only a ready, changed Assessment", async () => {
  const client = createClient({
    url: `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  });
  const db = drizzle(client, { schema });
  await migrateDatabase(client, db);
  await db.insert(schema.creator).values({
    id: "c1",
    name: "Ana",
    joinedAt: new Date(),
    signerName: "Ana",
    signatureKey: "sig",
  });
  await db
    .insert(schema.assessment)
    .values({ id: "a1", creatorId: "c1", title: "T", createdAt: new Date(), drawn: 1 });
  const options = [
    { text: "yes", correct: true },
    { text: "no", correct: false },
  ];
  await db.insert(schema.question).values({
    id: "q1",
    assessmentId: "a1",
    position: 1,
    type: "single",
    text: "Q?",
    options,
    keepOrder: false,
  });
  const status = async () =>
    (await db.select().from(schema.assessment).where(eq(schema.assessment.id, "a1")))[0];

  // Missing logo: refused. Not the Creator's: refused.
  expect(await publish(db, "a1", "c1")).toBeNull();
  await db.update(schema.creator).set({ logoKey: "logo" });
  expect(await publish(db, "a1", "someone-else")).toBeNull();

  expect(await publish(db, "a1", "c1")).toBe(1);
  expect((await status()).status).toBe("published");
  const v1 = await client.execute("select snapshot from assessment_version where number = 1");
  expect(await publish(db, "a1", "c1")).toBeNull(); // unchanged

  // Editing the working copy (even while Closed) makes Version 2 and leaves Version 1 alone.
  await db.update(schema.assessment).set({ status: "closed" });
  await db.update(schema.question).set({ text: "Edited?" });
  expect((await publishState(db, "a1", "c1"))?.changed).toBe(true);
  expect(await publish(db, "a1", "c1")).toBe(2);
  const after = await status();
  expect(after.status).toBe("closed");
  const versions = await db.select().from(schema.assessmentVersion);
  expect(after.currentVersionId).toBe(versions.find((v) => v.number === 2)?.id);
  expect(versions.find((v) => v.number === 2)?.snapshot.questions[0]).toMatchObject({
    id: "q1",
    text: "Edited?",
  });
  expect(await client.execute("select snapshot from assessment_version where number = 1")).toEqual(
    v1,
  );
  expect(JSON.parse(String(v1.rows[0].snapshot)).questions[0].text).toBe("Q?");
});
