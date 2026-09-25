import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { expect, it } from "vitest";
import { migrateDatabase } from "../db/migrate";
import * as schema from "../db/schema";
import { addInvites, inviteCount, removeInvites } from "./invites";

it("adds each invited email once, stores only its hash and removes at once", async () => {
  const client = createClient({
    url: `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  });
  const db = drizzle(client, { schema });
  await migrateDatabase(client, db);
  await db.insert(schema.creator).values({ id: "c1", name: "Ana", joinedAt: new Date() });
  await db
    .insert(schema.assessment)
    .values({ id: "a1", creatorId: "c1", title: "T", createdAt: new Date() });

  expect(await addInvites(db, "a1", ["bo@x.test", "cy@x.test"], "s")).toBe(2);
  expect(await addInvites(db, "a1", ["bo@x.test", " BO@x.test", "di@x.test"], "s")).toBe(1);
  expect(await inviteCount(db, "a1")).toBe(3);
  const stored = await db.select().from(schema.invite);
  expect(JSON.stringify(stored)).not.toContain("@");

  expect(await removeInvites(db, "a1", ["CY@x.test", "nobody@x.test"], "s")).toBe(1);
  expect(await inviteCount(db, "a1")).toBe(2);
});
