import { and, eq, isNull, lt, lte } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { bump, timeOut } from "./attempts";
import { utcDay } from "./one-time-code";

type Db = LibSQLDatabase<typeof schema>;
const { attempt, certificate, emailDay, oneTimeCode, session, verification } = schema;
const DAY = 24 * 60 * 60_000;
const HOUR = 60 * 60_000;

/** Times out overdue Attempts, counts Certificates that crossed Expiry, and deletes what's no
 * longer needed. Each item is its own short transaction, and each counts exactly once, so running
 * it twice or after downtime changes nothing more. A failed item is logged and retried next hour. */
export async function sweep(db: Db, now = new Date()) {
  const overdue = await db
    .select()
    .from(attempt)
    .where(and(eq(attempt.outcome, "in_progress"), lte(attempt.deadline, now)));
  for (const row of overdue) await orLog(() => db.transaction((tx) => timeOut(tx, row)));

  // Only valid ones: a revoked or replaced Certificate already left the valid count.
  const expired = await db
    .select({
      id: certificate.id,
      versionId: certificate.versionId,
      expiresAt: certificate.expiresAt,
    })
    .from(certificate)
    .where(
      and(
        eq(certificate.status, "valid"),
        isNull(certificate.expiryCountedAt),
        lte(certificate.expiresAt, now),
      ),
    );
  for (const row of expired)
    await orLog(() =>
      db.transaction(async (tx) => {
        const done = await tx
          .update(certificate)
          .set({ expiryCountedAt: now })
          .where(and(eq(certificate.id, row.id), isNull(certificate.expiryCountedAt)));
        if (done.rowsAffected === 1) await bump(tx, row.versionId, row.expiresAt!, ["expired"]);
      }),
    );

  const dayAgo = new Date(now.getTime() - DAY);
  await orLog(() => db.delete(oneTimeCode).where(lt(oneTimeCode.createdAt, dayAgo)));
  const weekAgo = utcDay(new Date(now.getTime() - 7 * DAY));
  await orLog(() => db.delete(emailDay).where(lt(emailDay.day, weekAgo)));
  await orLog(() => db.delete(session).where(lte(session.expiresAt, now)));
  await orLog(() => db.delete(verification).where(lte(verification.expiresAt, now)));
}

async function orLog(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (e) {
    console.error("Sweep:", e);
  }
}

/** Sweeps once at boot, then hourly. Once per process, even when dev reloads this module. */
export function startSweep(db: Db) {
  const g = globalThis as { quizzSweep?: true };
  if (g.quizzSweep) return;
  g.quizzSweep = true;
  const run = () => sweep(db).catch((e) => console.error("Sweep:", e));
  void run();
  setInterval(run, HOUR).unref();
}
