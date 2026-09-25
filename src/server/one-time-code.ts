import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { v7 as uuidv7 } from "uuid";
import * as schema from "../db/schema";
import { CODE_MINUTES } from "../domain/one-time-code";
import { emailHash } from "./email-hash";

type Db = LibSQLDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Purpose = (typeof schema.oneTimeCode.$inferSelect)["purpose"];
const { oneTimeCode, emailDay } = schema;

const MAX_WRONG = 5;
const PER_EMAIL = 3;
const PER_IP = 10;
const HOUR = 60 * 60_000;

const hashCode = (hash: string, code: string, secret = process.env.EMAIL_HMAC_SECRET!) =>
  createHmac("sha256", secret).update(`code:${hash}:${code}`).digest();

/** A statistics or email-cap day: the UTC date, "2026-09-25". */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Counts one sent email towards today's cap. Certificate emails call this and are never refused. */
export async function countEmail(db: Db | Tx, now = new Date()) {
  await db
    .insert(emailDay)
    .values({ day: utcDay(now), sent: 1 })
    .onConflictDoUpdate({ target: emailDay.day, set: { sent: sql`${emailDay.sent} + 1` } });
}

/** Emails sent today, towards the daily cap. */
export async function sentToday(db: Db | Tx, now = new Date()) {
  const [today] = await db
    .select()
    .from(emailDay)
    .where(eq(emailDay.day, utcDay(now)));
  return today?.sent ?? 0;
}

/** Stores a new code for the email, or says which limit refused it. The caller emails the code. */
export async function requestCode(
  db: Db,
  opts: { email: string; ip: string; purpose: Purpose; cap: number; now?: Date; secret?: string },
) {
  const now = opts.now ?? new Date();
  const hash = emailHash(opts.email, opts.secret);
  const since = new Date(now.getTime() - HOUR);
  const recent = async (tx: Tx, where: ReturnType<typeof eq>) =>
    (
      await tx
        .select({ n: count() })
        .from(oneTimeCode)
        .where(and(where, gt(oneTimeCode.createdAt, since)))
    )[0].n;
  // ponytail: check-then-insert, so two simultaneous requests can both pass a limit by one.
  return db.transaction(async (tx) => {
    if ((await recent(tx, eq(oneTimeCode.emailHash, hash))) >= PER_EMAIL)
      return { ok: false as const, reason: "email" as const };
    if ((await recent(tx, eq(oneTimeCode.ip, opts.ip))) >= PER_IP)
      return { ok: false as const, reason: "ip" as const };
    if ((await sentToday(tx, now)) >= opts.cap)
      return { ok: false as const, reason: "dailyCap" as const };

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await tx.insert(oneTimeCode).values({
      id: uuidv7(),
      emailHash: hash,
      codeHash: hashCode(hash, code, opts.secret).toString("hex"),
      purpose: opts.purpose,
      expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000),
      createdAt: now,
      ip: opts.ip,
    });
    await countEmail(tx, now);
    return { ok: true as const, code };
  });
}

/** Checks the typed code against the email's newest code; a right one is spent, never deleted. */
export async function verifyCode(
  db: Db,
  opts: { email: string; code: string; purpose: Purpose; now?: Date; secret?: string },
) {
  const now = opts.now ?? new Date();
  const hash = emailHash(opts.email, opts.secret);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(oneTimeCode)
      .where(and(eq(oneTimeCode.emailHash, hash), eq(oneTimeCode.purpose, opts.purpose)))
      .orderBy(desc(oneTimeCode.createdAt), desc(oneTimeCode.id))
      .limit(1);
    if (!row) return { ok: false as const, reason: "expired" as const };
    if (row.wrongTries >= MAX_WRONG) return { ok: false as const, reason: "locked" as const };
    if (row.expiresAt <= now) return { ok: false as const, reason: "expired" as const };

    const typed = hashCode(hash, opts.code.replace(/\s/g, ""), opts.secret);
    if (timingSafeEqual(typed, Buffer.from(row.codeHash, "hex"))) {
      await tx.update(oneTimeCode).set({ expiresAt: now }).where(eq(oneTimeCode.id, row.id));
      return { ok: true as const };
    }
    await tx
      .update(oneTimeCode)
      .set({ wrongTries: sql`${oneTimeCode.wrongTries} + 1` })
      .where(eq(oneTimeCode.id, row.id));
    const left = MAX_WRONG - row.wrongTries - 1;
    return left > 0
      ? { ok: false as const, reason: "wrong" as const, left }
      : { ok: false as const, reason: "locked" as const };
  });
}
