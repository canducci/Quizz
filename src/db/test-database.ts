import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, type Pool } from "pg";
import { onTestFinished } from "vitest";
import { isPostgres } from "./dialect";
import { migrateDatabase } from "./migrate";
import { openDatabase } from "./open";

/** A fresh, migrated database for one test: a temp SQLite file, or with a Postgres DATABASE_URL a
 * new database on that server, dropped when the test ends. Call it inside a test. */
export async function testDatabase() {
  const server = process.env.DATABASE_URL ?? "";
  if (!isPostgres(server)) {
    const db = openDatabase(`file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`);
    await migrateDatabase(db);
    return db;
  }
  const name = `quizz_test_${randomUUID().replaceAll("-", "")}`;
  await admin(server, `create database ${name}`);
  const url = new URL(server);
  url.pathname = `/${name}`;
  const db = openDatabase(url.href);
  onTestFinished(async () => {
    await (db.$client as Pool).end();
    await admin(server, `drop database ${name} with (force)`);
  });
  await migrateDatabase(db);
  return db;
}

async function admin(url: string, statement: string) {
  const client = new Client(url);
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}
