import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/open";
import { migrateDatabase } from "../db/migrate";
import * as schema from "../db/schema";
import { publish } from "./publish";

export const MINUTE = 60_000;
export const at = (minutes: number) => new Date(Date.UTC(2026, 8, 25, 12) + minutes * MINUTE);

/** A published Assessment "a1": 3 of 3 single-answer Questions, option 0 right, 10 minutes, 67% to pass. */
export async function published(expiryDays: number | null = null) {
  const { client, db } = openDatabase(
    `file:${join(mkdtempSync(join(tmpdir(), "quizz-")), "t.db")}`,
  );
  await migrateDatabase(client, db);
  await db.insert(schema.creator).values({
    id: "c1",
    name: "Ana",
    joinedAt: new Date(),
    logoKey: "logo",
    signerName: "Ana",
    signatureKey: "sig",
  });
  await db.insert(schema.assessment).values({
    id: "a1",
    creatorId: "c1",
    title: "T",
    createdAt: new Date(),
    drawn: 3,
    passingScore: 67,
    timeLimit: 10,
    expiryDays,
  });
  await db.insert(schema.question).values(
    ["q1", "q2", "q3"].map((id, i) => ({
      id,
      assessmentId: "a1",
      position: i,
      type: "single" as const,
      text: id,
      options: [
        { text: "right", correct: true },
        { text: "wrong", correct: false },
      ],
      keepOrder: false,
    })),
  );
  await publish(db, "a1", "c1");
  const stats = async () => (await db.select().from(schema.statsDay))[0];
  return { db, stats };
}
