import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./open";
import { expect, it } from "vitest";
import { ensureCreator } from "./creator";
import { migrateDatabase } from "./migrate";
import * as schema from "./schema";

it("makes a signed-in user a Creator exactly once, even if an earlier attempt failed", async () => {
  const { client, db } = openDatabase(
    `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  );
  await migrateDatabase(client, db);
  await db.insert(schema.user).values({ id: "u1", name: "Ana", email: "ana@example.test" });

  await ensureCreator(db, "u1");
  await ensureCreator(db, "u1");

  const creators = await db.select().from(schema.creator);
  expect(creators).toHaveLength(1);
  expect(creators[0]).toMatchObject({ authUserId: "u1", name: "Ana" });
});
