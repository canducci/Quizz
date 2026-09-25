import { and, asc, eq, gte, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { daysFrom, summarize } from "../domain/statistics";
import { utcDay } from "./one-time-code";

type Db = LibSQLDatabase<typeof schema>;
const { assessmentVersion, statsDay } = schema;
const DAY = 24 * 60 * 60_000;

export const RANGES = ["7", "30", "90", "all"] as const;
export type Range = (typeof RANGES)[number];

/** A Question's label for charts: its first line of prose, no Markdown syntax, cut short.
 * ponytail: regex stripping, not a Markdown parser; odd Markdown can leave stray characters. */
const label = (markdown: string) => {
  const line = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .split("\n")
    .map((l) => l.replace(/[#>*_`]/g, "").trim())
    .find(Boolean);
  return line && line.length > 80 ? `${line.slice(0, 79)}…` : (line ?? "");
};

/** Assessment Statistics from the `stats_day` counters only: never an Attempt or a Learner
 * (ADR 0002). `version` is a Version number; one the Assessment doesn't have means all. */
export async function assessmentStatistics(
  db: Db,
  assessmentId: string,
  filter: { range: Range; version?: number },
  now = new Date(),
) {
  const versions = await db
    .select({
      id: assessmentVersion.id,
      number: assessmentVersion.number,
      snapshot: assessmentVersion.snapshot,
    })
    .from(assessmentVersion)
    .where(eq(assessmentVersion.assessmentId, assessmentId))
    .orderBy(asc(assessmentVersion.number));
  const chosen = versions.find((v) => v.number === filter.version) ?? null;
  const today = utcDay(now);
  const from =
    filter.range === "all" ? null : utcDay(new Date(now.getTime() - (+filter.range - 1) * DAY));
  const rows = versions.length
    ? await db
        .select()
        .from(statsDay)
        .where(
          and(
            inArray(statsDay.versionId, chosen ? [chosen.id] : versions.map((v) => v.id)),
            from ? gte(statsDay.day, from) : undefined,
          ),
        )
    : [];
  const first = from ?? rows.map((r) => r.day).sort()[0] ?? today;
  const summary = summarize(rows, daysFrom(first, today));

  // The chosen (or newest) Version first, so Questions follow its order and wording; then older
  // Versions' removed Questions. Numbered after dropping unseen ones, so there are no gaps.
  const texts = new Map<string, string>();
  for (const v of chosen ? [chosen] : [...versions].reverse())
    for (const q of v.snapshot.questions) if (!texts.has(q.id)) texts.set(q.id, label(q.text));
  const questions = [...texts]
    .filter(([id]) => summary.questions[id]?.shown)
    .map(([id, text], i) => ({ n: i + 1, text, ...summary.questions[id] }));

  const current = chosen ?? versions.at(-1);
  return {
    ...summary,
    questions,
    versions: versions.map((v) => ({
      number: v.number,
      passingScore: v.snapshot.settings.passingScore,
    })),
    version: chosen?.number ?? null,
    passingScore: chosen?.snapshot.settings.passingScore ?? null,
    timeLimit: current?.snapshot.settings.timeLimit ?? null,
  };
}
