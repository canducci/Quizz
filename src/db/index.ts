import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { openDatabase } from "./open";

export const databaseUrl = process.env.DATABASE_URL ?? "file:./data/quizz.db";

// libsql opens the file at once and won't create its folder.
if (databaseUrl.startsWith("file:")) {
  mkdirSync(dirname(databaseUrl.slice("file:".length)), { recursive: true });
}

export const { client, db } = openDatabase(databaseUrl);
