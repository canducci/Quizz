import { expect, it } from "vitest";
import * as schema from "../db/schema";
import { assessmentStatistics } from "./statistics";
import { at, published } from "./test-db";

it("reads the range's days and one Version's counters, never another Assessment's", async () => {
  const { db } = await published();
  const [v1] = await db.select().from(schema.assessmentVersion);
  await db.insert(schema.assessmentVersion).values({
    ...v1,
    id: "v2",
    number: 2,
    snapshot: { ...v1.snapshot, settings: { ...v1.snapshot.settings, passingScore: 90 } },
  });
  await db.insert(schema.statsDay).values([
    { versionId: v1.id, day: "2026-09-01", attempts: 5 },
    {
      versionId: v1.id,
      day: "2026-09-24",
      attempts: 2,
      questions: { q2: { shown: 2, correct: 0 } },
    },
    { versionId: "v2", day: "2026-09-25", attempts: 1 },
  ]);
  const now = at(0); // 2026-09-25

  const week = await assessmentStatistics(db, "a1", { range: "7" }, now);
  expect(week.attempts).toBe(3);
  expect(week.perDay).toHaveLength(7);
  // q1 was never shown, so q2 is numbered 1: no gaps.
  expect(week.questions).toEqual([{ n: 1, text: "q2", shown: 2, correct: 0 }]);
  expect(week.passingScore).toBeNull();

  const all = await assessmentStatistics(db, "a1", { range: "all" }, now);
  expect(all.attempts).toBe(8);
  expect(all.perDay[0].day).toBe("2026-09-01");

  const v2 = await assessmentStatistics(db, "a1", { range: "all", version: 2 }, now);
  expect(v2).toMatchObject({ attempts: 1, version: 2, passingScore: 90 });
  // A Version number the Assessment doesn't have shows all of them.
  expect((await assessmentStatistics(db, "a1", { range: "all", version: 7 }, now)).attempts).toBe(
    8,
  );
  expect((await assessmentStatistics(db, "other", { range: "all" }, now)).attempts).toBe(0);
});
