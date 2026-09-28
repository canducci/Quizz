import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { isPostgres } from "./dialect";
import { migrateDatabase } from "./migrate";
import * as schema from "./schema";
import { testDatabase } from "./test-database";

it("migrates a fresh database, SQLite in WAL mode, with the auth and creator tables", async () => {
  const db = await testDatabase();
  await migrateDatabase(db); // a restart is a no-op

  if (!isPostgres())
    expect(await db.get(sql`PRAGMA journal_mode`)).toEqual({ journal_mode: "wal" });
  for (const table of [schema.user, schema.session, schema.account, schema.verification])
    expect(await db.select().from(table)).toEqual([]);
  expect(await db.select().from(schema.creator)).toEqual([]);
});
