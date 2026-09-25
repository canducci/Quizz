import type { QuestionContent } from "./question";

type PoolQuestion = QuestionContent & { id: string };
/** The Questions an Attempt drew, each with its options in the order the Learner sees them. */
export type Drawn = { id: string; order: number[] }[];
/** Chosen options per Question id, as indices into the Question's own (unshuffled) options. */
export type Answers = Record<string, number[]>;
export type Histogram = Record<string, number>;
/** The longest name a Learner may put on a Certificate. */
export const MAX_NAME = 200;

export type QuestionTally = Record<string, { shown: number; correct: number }>;

function shuffle<T>(items: T[], random: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** N random Questions from the pool, options shuffled unless the Question keeps its order. */
export function draw(pool: PoolQuestion[], n: number, random = Math.random): Drawn {
  return shuffle(pool, random)
    .slice(0, n)
    .map((q) => {
      const order = q.options.map((_, i) => i);
      return { id: q.id, order: q.keepOrder ? order : shuffle(order, random) };
    });
}

/** A Learner's choice for one Question, sorted and deduped, or null if it can't be an answer. */
export function cleanChoice(q: QuestionContent, choice: unknown): number[] | null {
  if (!Array.isArray(choice)) return null;
  if (!choice.every((i) => Number.isInteger(i) && i >= 0 && i < q.options.length)) return null;
  const clean = [...new Set(choice as number[])].sort((a, b) => a - b);
  return q.type !== "multi" && clean.length > 1 ? null : clean;
}

const isRight = (q: QuestionContent, chosen: number[] = []) => {
  const right = q.options.flatMap((o, i) => (o.correct ? [i] : []));
  return right.length === chosen.length && right.every((i) => chosen.includes(i));
};

/** Whole-percent score, rounded down so a fail never shows the Passing Score. */
export function scoreAttempt(
  questions: PoolQuestion[],
  drawn: Drawn,
  answers: Answers,
  passingScore: number,
) {
  const correct = drawn
    .filter((d) =>
      isRight(
        questions.find((q) => q.id === d.id)!,
        answers[d.id],
      ),
    )
    .map((d) => d.id);
  return {
    score: Math.floor((correct.length * 100) / drawn.length),
    passed: correct.length * 100 >= passingScore * drawn.length,
    correct,
  };
}

export const deadlineOf = (startedAt: Date, timeLimitMinutes: number) =>
  new Date(startedAt.getTime() + timeLimitMinutes * 60_000);

export const isOverdue = (deadline: Date, now: Date) => now.getTime() >= deadline.getTime();

export const minutesTaken = (startedAt: Date, submittedAt: Date) =>
  Math.floor((submittedAt.getTime() - startedAt.getTime()) / 60_000);

/** The histogram with one more in `bucket`; a new object, the old one untouched. */
export const histogram = (h: Histogram | null, bucket: number): Histogram => ({
  ...h,
  [bucket]: (h?.[bucket] ?? 0) + 1,
});

/** Per-Question counts with every drawn Question shown once more, and the right ones correct. */
export function tally(t: QuestionTally | null, drawn: Drawn, correct: string[]) {
  const out: QuestionTally = { ...t };
  for (const { id } of drawn) {
    const was = out[id] ?? { shown: 0, correct: 0 };
    out[id] = { shown: was.shown + 1, correct: was.correct + (correct.includes(id) ? 1 : 0) };
  }
  return out;
}

/** What the browser gets: the drawn Questions in order, options in display order with their
 * original index, and never which ones are correct. */
export type LearnerQuestion = {
  id: string;
  type: QuestionContent["type"];
  text: string;
  options: { text: string; index: number }[];
};

export const learnerQuestions = (questions: PoolQuestion[], drawn: Drawn): LearnerQuestion[] =>
  drawn.map(({ id, order }) => {
    const q = questions.find((x) => x.id === id)!;
    return {
      id,
      type: q.type,
      text: q.text,
      options: order.map((i) => ({ text: q.options[i].text, index: i })),
    };
  });
