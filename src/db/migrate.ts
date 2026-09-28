import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import type { Db } from "./open";

export async function migrateDatabase(db: Db) {
  const folder = (dialect: string) => ({
    migrationsFolder: join(process.cwd(), "drizzle", dialect),
  });
  if (db.$client instanceof Pool) return migratePg(db as unknown as NodePgDatabase, folder("pg"));
  // The one SQLite-only statement ADR 0006 tolerates: ticket 01 asks for WAL.
  await db.run(sql`PRAGMA journal_mode = WAL`);
  await migrate(db, folder("sqlite"));
}
