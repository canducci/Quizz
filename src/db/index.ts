import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const databaseUrl = process.env.DATABASE_URL ?? "file:./data/quizz.db";

// libsql opens the file at once and won't create its folder.
if (databaseUrl.startsWith("file:")) {
  mkdirSync(dirname(databaseUrl.slice("file:".length)), { recursive: true });
}

export const client = createClient({ url: databaseUrl });
export const db = drizzle(client, { schema });
