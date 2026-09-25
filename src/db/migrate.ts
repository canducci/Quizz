import { join } from "node:path";
import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

export async function migrateDatabase(client: Client, db: LibSQLDatabase<Record<string, unknown>>) {
  // The one SQLite-only statement ADR 0006 tolerates: ticket 01 asks for WAL. Drop it on the move to Postgres.
  await client.execute("PRAGMA journal_mode = WAL");
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
}
