import { expect, it } from "vitest";
import { daysFrom, median, needsReview, summarize, type DayCounters } from "./statistics";

const row = (day: string, counters: Partial<DayCounters>): DayCounters => ({
  day,
  attempts: 0,
  timedOut: 0,
  submitted: 0,
  passed: 0,
  certificatesIssued: 0,
  revoked: 0,
  expired: 0,
  scoreHistogram: null,
  timeHistogram: null,
  questions: null,
  ...counters,
});

it("reads the median from a histogram, buckets in number order", () => {
  expect(median({})).toBeNull();
  expect(median({ 7: 1 })).toBe(7);
  // 9 sorts before 10 as a string; the median of 2, 9, 10, 10, 10 is 10.
  expect(median({ 10: 3, 9: 1, 2: 1 })).toBe(10);
  // Even count: the lower middle.
  expect(median({ 3: 2, 8: 2 })).toBe(3);
});

it("lists every UTC day from the first to the last", () => {
  expect(daysFrom("2026-09-29", "2026-10-02")).toEqual([
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
  ]);
  expect(daysFrom("2026-10-02", "2026-10-02")).toEqual(["2026-10-02"]);
});

it("adds counters across days and Versions, filling days without Attempts", () => {
  const s = summarize(
    [
      // Two Versions on the same day, then one two days later.
      row("2026-09-01", {
        attempts: 3,
        submitted: 2,
        passed: 1,
        certificatesIssued: 1,
        scoreHistogram: { 40: 1, 100: 1 },
        timeHistogram: { 4: 1, 9: 1 },
        questions: { q1: { shown: 2, correct: 1 }, q2: { shown: 1, correct: 1 } },
      }),
      row("2026-09-01", {
        attempts: 1,
        timedOut: 1,
        revoked: 1,
      }),
      row("2026-09-03", {
        attempts: 2,
        submitted: 2,
        passed: 2,
        certificatesIssued: 2,
        expired: 1,
        scoreHistogram: { 100: 1, 95: 1 },
        timeHistogram: { 9: 2 },
        questions: { q1: { shown: 2, correct: 2 } },
      }),
    ],
    ["2026-09-01", "2026-09-02", "2026-09-03"],
  );
  expect(s.perDay).toEqual([
    { day: "2026-09-01", attempts: 4 },
    { day: "2026-09-02", attempts: 0 },
    { day: "2026-09-03", attempts: 2 },
  ]);
  expect(s).toMatchObject({
    attempts: 6,
    timedOut: 1,
    submitted: 4,
    passed: 3,
    certificatesIssued: 3,
    revoked: 1,
    expired: 1,
    medianMinutes: 9,
  });
  // 1% buckets folded into tens; 100 joins 90–100.
  expect(s.scoreBins).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 3]);
  expect(s.questions).toEqual({ q1: { shown: 4, correct: 3 }, q2: { shown: 1, correct: 1 } });
  // Of the 5 finished Attempts (submitted or Timed out), 3 passed.
  expect(s.passRate).toBe(0.6);
});

it("has no pass rate before anything finished", () => {
  expect(summarize([row("2026-09-01", { attempts: 1 })], ["2026-09-01"]).passRate).toBeNull();
});

it("flags Questions answered correctly under 50% of the time", () => {
  expect(needsReview({ shown: 3, correct: 1 })).toBe(true);
  expect(needsReview({ shown: 2, correct: 1 })).toBe(false);
  // 49.6% rounds to 50%: what the chart shows decides the flag.
  expect(needsReview({ shown: 250, correct: 124 })).toBe(false);
});
