import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { expect, it } from "vitest";
import { migrateDatabase } from "../db/migrate";
import * as schema from "../db/schema";
import { countEmail, requestCode, verifyCode } from "./one-time-code";

const SECRET = "test-secret";
const MINUTE = 60_000;

async function testDb() {
  const client = createClient({
    url: `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  });
  const db = drizzle(client, { schema });
  await migrateDatabase(client, db);
  return db;
}

const at = (minutes: number) => new Date(Date.UTC(2026, 8, 25, 12) + minutes * MINUTE);

it("sends a 6-digit code that works once, for 10 minutes", async () => {
  const db = await testDb();
  const ask = (email: string, now = at(0)) =>
    requestCode(db, { email, ip: "1.1.1.1", purpose: "attempt", cap: 300, now, secret: SECRET });
  const check = (email: string, code: string, now: Date) =>
    verifyCode(db, { email, code, purpose: "attempt", now, secret: SECRET });

  const sent = await ask("ana@example.com");
  if (!sent.ok) throw new Error("refused");
  expect(sent.code).toMatch(/^\d{6}$/);
  // The email is normalised; spaces in the typed code are ignored.
  expect(await check(" ANA@example.com", sent.code.replace(/(...)/, "$1 "), at(9))).toEqual({
    ok: true,
  });
  expect(await check("ana@example.com", sent.code, at(9))).toEqual({
    ok: false,
    reason: "expired",
  });

  const late = await ask("bia@example.com");
  if (!late.ok) throw new Error("refused");
  expect(await check("bia@example.com", late.code, at(11))).toEqual({
    ok: false,
    reason: "expired",
  });
  // Only the newest code counts.
  const first = await ask("cai@example.com");
  const second = await ask("cai@example.com");
  if (!first.ok || !second.ok) throw new Error("refused");
  if (first.code !== second.code)
    expect((await check("cai@example.com", first.code, at(1))).ok).toBe(false);
  expect((await check("cai@example.com", second.code, at(1))).ok).toBe(true);
  expect(await check("nobody@example.com", "123456", at(1))).toEqual({
    ok: false,
    reason: "expired",
  });
});

it("locks a code after 5 wrong tries, even against the right code", async () => {
  const db = await testDb();
  const sent = await requestCode(db, {
    email: "ana@example.com",
    ip: "1.1.1.1",
    purpose: "attempt",
    cap: 300,
    now: at(0),
    secret: SECRET,
  });
  if (!sent.ok) throw new Error("refused");
  const wrong = String((Number(sent.code) + 1) % 1_000_000).padStart(6, "0");
  const check = (code: string) =>
    verifyCode(db, {
      email: "ana@example.com",
      code,
      purpose: "attempt",
      now: at(1),
      secret: SECRET,
    });
  for (const left of [4, 3, 2, 1])
    expect(await check(wrong)).toEqual({ ok: false, reason: "wrong", left });
  expect(await check(wrong)).toEqual({ ok: false, reason: "locked" });
  expect(await check(sent.code)).toEqual({ ok: false, reason: "locked" });
  expect(await check("not a code")).toEqual({ ok: false, reason: "locked" });
});

it("allows 3 codes per email and 10 per IP an hour, used or not", async () => {
  const db = await testDb();
  const ask = (email: string, ip: string, now: Date) =>
    requestCode(db, { email, ip, purpose: "attempt", cap: 300, now, secret: SECRET });

  const used = await ask("ana@example.com", "1.1.1.1", at(0));
  if (!used.ok) throw new Error("refused");
  await verifyCode(db, {
    email: "ana@example.com",
    code: used.code,
    purpose: "attempt",
    now: at(1),
    secret: SECRET,
  });
  expect((await ask("ana@example.com", "1.1.1.1", at(1))).ok).toBe(true);
  expect((await ask("ana@example.com", "2.2.2.2", at(2))).ok).toBe(true);
  expect(await ask("ANA@example.com", "3.3.3.3", at(3))).toEqual({ ok: false, reason: "email" });
  expect((await ask("ana@example.com", "3.3.3.3", at(61))).ok).toBe(true);

  for (let i = 0; i < 10; i++)
    expect((await ask(`l${i}@example.com`, "9.9.9.9", at(0))).ok).toBe(true);
  expect(await ask("l10@example.com", "9.9.9.9", at(30))).toEqual({ ok: false, reason: "ip" });
  expect((await ask("l10@example.com", "9.9.9.9", at(60))).ok).toBe(true);
});

it("stops codes at the daily email cap, which Certificate emails still count towards", async () => {
  const db = await testDb();
  const ask = (email: string, now: Date) =>
    requestCode(db, { email, ip: email, purpose: "attempt", cap: 2, now, secret: SECRET });
  expect((await ask("a@example.com", at(0))).ok).toBe(true);
  await countEmail(db, at(0)); // a Certificate email
  expect(await ask("b@example.com", at(1))).toEqual({ ok: false, reason: "dailyCap" });
  await countEmail(db, at(1)); // Certificate emails are never refused
  // A new UTC day starts again.
  expect((await ask("b@example.com", at(12 * 60))).ok).toBe(true);
});
