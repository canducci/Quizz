import { setTimeout as sleep } from "node:timers/promises";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { isPostgres } from "./dialect";
import * as pgSchema from "./schema.pg";
import * as schema from "./schema.sqlite";

/** Both dialects are typed as SQLite's (ADR 0007); only the driver underneath tells them apart. */
export type Db = LibSQLDatabase<typeof schema> & { $client: Client | Pool };
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Opens the database the way the app does, SQLite or Postgres by the URL. Either way every
 * `db.transaction` behaves as if it ran alone:
 * - SQLite has one writer, and libsql's BEGIN fails at once with SQLITE_BUSY while another
 *   transaction holds the lock (a busy timeout would block the event loop), so this process's
 *   transactions wait their turn in a queue. Never call `db.transaction` inside one: it would wait
 *   for itself.
 * - Postgres runs them in parallel at SERIALIZABLE and reruns one that lost a race, so the
 *   callback must have no side effects outside the database. */
export function openDatabase(url: string): Db {
  return isPostgres(url) ? openPostgres(url) : openSqlite(url);
}

function openSqlite(url: string) {
  const db = drizzle(createClient({ url }), { schema });
  const transaction = db.transaction.bind(db);
  let queue: Promise<unknown> = Promise.resolve();
  db.transaction = ((...args: Parameters<typeof transaction>) => {
    const turn = queue.then(() => transaction(...args));
    queue = turn.catch(() => {});
    return turn;
  }) as typeof transaction;
  return db;
}

// ponytail: gives up after 10 tries (about 5 s) and throws; queue hot rows if contention gets there.
const TRIES = 10;
// Serialization failure (SERIALIZABLE reports a racing unique key as one too) and deadlock: a rerun
// reads the winner's rows, as it would have under SQLite's queue.
const RACE_CODES = new Set(["40001", "40P01"]);

function openPostgres(url: string) {
  // allowExitOnIdle: the Operator CLI and tests exit without closing the pool.
  const db = drizzlePg(new Pool({ connectionString: url, allowExitOnIdle: true }), {
    schema: pgSchema,
  });
  const transaction = db.transaction.bind(db);
  db.transaction = (async (run, config) => {
    for (let tries = 1; ; tries++) {
      try {
        return await transaction(run, { isolationLevel: "serializable", ...config });
      } catch (error) {
        if (tries === TRIES || !RACE_CODES.has(pgCode(error))) throw error;
        await sleep(Math.random() * 2 ** tries * 5); // full jitter, 5 s at most over all tries
      }
    }
  }) as typeof transaction;
  return db as unknown as Db;
}

/** Drizzle wraps the driver's error, which carries the SQLSTATE code. */
function pgCode(error: unknown): string {
  for (let e = error; e instanceof Error; e = e.cause)
    if ("code" in e && typeof e.code === "string") return e.code;
  return "";
}
