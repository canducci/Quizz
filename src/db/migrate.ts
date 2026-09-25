import { join } from "node:path";
import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

export async function migrateDatabase(client: Client, db: LibSQLDatabase<Record<string, unknown>>) {
  await client.execute("PRAGMA journal_mode = WAL");
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
}
