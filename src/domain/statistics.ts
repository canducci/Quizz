import type { Histogram, QuestionTally } from "./attempt";

/** One `stats_day` row's counters. */
export type DayCounters = {
  day: string;
  attempts: number;
  timedOut: number;
  submitted: number;
  passed: number;
  certificatesIssued: number;
  revoked: number;
  expired: number;
  scoreHistogram: Histogram | null;
  timeHistogram: Histogram | null;
  questions: QuestionTally | null;
};

const COUNTERS = [
  "attempts",
  "timedOut",
  "submitted",
  "passed",
  "certificatesIssued",
  "revoked",
  "expired",
] as const;
const DAY = 24 * 60 * 60_000;

/** The bucket holding the middle count (the lower one of two), or null if empty. */
export function median(h: Histogram) {
  const buckets = Object.keys(h)
    .map(Number)
    .sort((a, b) => a - b);
  const total = buckets.reduce((sum, b) => sum + h[b], 0);
  let seen = 0;
  for (const b of buckets) if ((seen += h[b]) * 2 >= total) return b;
  return null;
}

/** Every UTC day ("2026-09-25") from `first` to `last`, both included. */
export function daysFrom(first: string, last: string) {
  const days = [];
  for (let t = Date.parse(first); t <= Date.parse(last); t += DAY)
    days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}

/** Totals over the rows, whatever their day and Version, and Attempts on each of `days`. */
export function summarize(rows: DayCounters[], days: string[]) {
  const totals = Object.fromEntries(
    COUNTERS.map((c) => [c, rows.reduce((sum, r) => sum + r[c], 0)]),
  ) as Record<(typeof COUNTERS)[number], number>;
  const scores: Histogram = {};
  const times: Histogram = {};
  const questions: QuestionTally = {};
  for (const r of rows) {
    for (const [b, n] of Object.entries(r.scoreHistogram ?? {})) scores[b] = (scores[b] ?? 0) + n;
    for (const [b, n] of Object.entries(r.timeHistogram ?? {})) times[b] = (times[b] ?? 0) + n;
    for (const [id, q] of Object.entries(r.questions ?? {})) {
      const sum = (questions[id] ??= { shown: 0, correct: 0 });
      sum.shown += q.shown;
      sum.correct += q.correct;
    }
  }
  const scoreBins = Array<number>(10).fill(0);
  for (const [b, n] of Object.entries(scores)) scoreBins[Math.min(9, Math.floor(+b / 10))] += n;
  // Counters are dated by their own event (start, deadline, submit), so a range can hold passes
  // of Attempts started before it: finished Attempts, not started ones, keep the rate under 100%.
  const finished = totals.submitted + totals.timedOut;
  return {
    ...totals,
    passRate: finished ? totals.passed / finished : null,
    medianMinutes: median(times),
    scoreBins,
    questions,
    perDay: days.map((day) => ({
      day,
      attempts: rows.filter((r) => r.day === day).reduce((sum, r) => sum + r.attempts, 0),
    })),
  };
}
