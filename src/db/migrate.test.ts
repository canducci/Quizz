import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { expect, it } from "vitest";
import { migrateDatabase } from "./migrate";

it("migrates a fresh file into WAL mode with the auth and creator tables", async () => {
  const client = createClient({
    url: `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  });
  await migrateDatabase(client, drizzle(client));
  await migrateDatabase(client, drizzle(client)); // a restart is a no-op

  const mode = await client.execute("PRAGMA journal_mode");
  expect(mode.rows[0].journal_mode).toBe("wal");
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  expect(tables.rows.map((r) => r.name)).toEqual(
    expect.arrayContaining(["user", "session", "account", "verification", "creator"]),
  );
});
