import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Opens the database the way the app does. SQLite has one writer, and libsql's BEGIN fails at
 * once with SQLITE_BUSY while another transaction holds the lock (a busy timeout would block the
 * event loop), so this process's transactions wait their turn in a queue. Never call
 * `db.transaction` inside one: it would wait for itself. */
export function openDatabase(url: string) {
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  const transaction = db.transaction.bind(db);
  let queue: Promise<unknown> = Promise.resolve();
  db.transaction = ((...args: Parameters<typeof transaction>) => {
    const turn = queue.then(() => transaction(...args));
    queue = turn.catch(() => {});
    return turn;
  }) as typeof transaction;
  return { client, db };
}
