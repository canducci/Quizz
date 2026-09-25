import { describe, expect, it } from "vitest";
import {
  cleanChoice,
  deadlineOf,
  draw,
  histogram,
  isOverdue,
  learnerQuestions,
  minutesTaken,
  scoreAttempt,
  tally,
} from "./attempt";
import type { QuestionContent } from "./question";

const opts = (...correct: boolean[]) => correct.map((c, i) => ({ text: `o${i}`, correct: c }));
const q = (id: string, type: QuestionContent["type"], correct: boolean[], keepOrder = false) => ({
  id,
  type,
  text: id,
  options: opts(...correct),
  keepOrder,
});

// A seeded generator, so the draw is repeatable.
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("draw", () => {
  const pool = [
    q("a", "single", [true, false, false, false]),
    q("b", "multi", [true, true, false, false]),
    q("c", "truefalse", [true, false], true),
    q("d", "single", [false, true, false, false], true),
    q("e", "single", [false, true, false]),
  ];

  it("picks N distinct Questions from the pool", () => {
    const drawn = draw(pool, 3, seeded(1));
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn.map((d) => d.id)).size).toBe(3);
    drawn.forEach((d) => expect(pool.map((p) => p.id)).toContain(d.id));
  });

  it("varies with the random source and keeps every Question reachable", () => {
    const seen = new Set<string>();
    for (let s = 1; s < 50; s++)
      draw(pool, 1, seeded(s * 1_000_003)).forEach((d) => seen.add(d.id));
    expect(seen).toEqual(new Set(["a", "b", "c", "d", "e"]));
  });

  it("shuffles options unless keep order, always a permutation", () => {
    let shuffled = false;
    for (let s = 1; s < 20; s++) {
      for (const d of draw(pool, 5, seeded(s * 1_000_003))) {
        const source = pool.find((p) => p.id === d.id)!;
        expect([...d.order].sort()).toEqual(source.options.map((_, i) => i));
        if (source.keepOrder) expect(d.order).toEqual(source.options.map((_, i) => i));
        else if (d.order.some((o, i) => o !== i)) shuffled = true;
      }
    }
    expect(shuffled).toBe(true);
  });
});

describe("cleanChoice", () => {
  it("keeps valid option indices, sorted and unique", () => {
    expect(cleanChoice(q("m", "multi", [true, true, false]), [2, 0, 2])).toEqual([0, 2]);
    expect(cleanChoice(q("m", "multi", [true, true, false]), [])).toEqual([]);
  });

  it("refuses out-of-range, non-integer and several answers to a one-answer Question", () => {
    const single = q("s", "single", [true, false]);
    expect(cleanChoice(single, [2])).toBeNull();
    expect(cleanChoice(single, [-1])).toBeNull();
    expect(cleanChoice(single, [0.5])).toBeNull();
    expect(cleanChoice(single, "0")).toBeNull();
    expect(cleanChoice(single, [0, 1])).toBeNull();
    expect(cleanChoice(q("t", "truefalse", [false, true]), [0, 1])).toBeNull();
  });
});

describe("scoreAttempt", () => {
  const questions = [
    q("s", "single", [false, true, false]),
    q("m", "multi", [true, false, true]),
    q("t", "truefalse", [false, true]),
  ];
  const drawn = questions.map((x) => ({ id: x.id, order: x.options.map((_, i) => i) }));

  it("marks each type right only on the exact correct set", () => {
    const all = { s: [1], m: [0, 2], t: [1] };
    expect(scoreAttempt(questions, drawn, all, 100)).toEqual({
      score: 100,
      passed: true,
      correct: ["s", "m", "t"],
    });
    const partialMulti = { s: [1], m: [0], t: [1] };
    expect(scoreAttempt(questions, drawn, partialMulti, 50).correct).toEqual(["s", "t"]);
    const extraMulti = { s: [1], m: [0, 1, 2], t: [1] };
    expect(scoreAttempt(questions, drawn, extraMulti, 50).correct).toEqual(["s", "t"]);
    const wrong = { s: [0], m: [1], t: [0] };
    expect(scoreAttempt(questions, drawn, wrong, 50)).toEqual({
      score: 0,
      passed: false,
      correct: [],
    });
  });

  it("counts unanswered as wrong", () => {
    expect(scoreAttempt(questions, drawn, {}, 1)).toEqual({ score: 0, passed: false, correct: [] });
  });

  it("never shows a failing score at or above the Passing Score", () => {
    const twoOfThree = { s: [1], m: [0, 2] };
    // 66.67% rounds down, so 67% to pass fails with 66.
    expect(scoreAttempt(questions, drawn, twoOfThree, 67)).toMatchObject({
      score: 66,
      passed: false,
    });
    expect(scoreAttempt(questions, drawn, twoOfThree, 66)).toMatchObject({
      score: 66,
      passed: true,
    });
  });

  it("scores only the drawn Questions", () => {
    expect(scoreAttempt(questions, drawn.slice(0, 1), { s: [1], m: [0, 2] }, 100)).toEqual({
      score: 100,
      passed: true,
      correct: ["s"],
    });
  });
});

describe("the clock", () => {
  const start = new Date(Date.UTC(2026, 8, 25, 12));

  it("sets the deadline from the time limit and is overdue from the deadline on", () => {
    const deadline = deadlineOf(start, 10);
    expect(deadline.getTime() - start.getTime()).toBe(10 * 60_000);
    expect(isOverdue(deadline, new Date(deadline.getTime() - 1))).toBe(false);
    expect(isOverdue(deadline, deadline)).toBe(true);
  });

  it("buckets time taken in whole minutes", () => {
    expect(minutesTaken(start, new Date(start.getTime() + 59_999))).toBe(0);
    expect(minutesTaken(start, new Date(start.getTime() + 125_000))).toBe(2);
  });
});

it("histogram adds one to a bucket without touching the others", () => {
  const before = { "3": 2 };
  expect(histogram(before, 3)).toEqual({ "3": 3 });
  expect(histogram(before, 7)).toEqual({ "3": 2, "7": 1 });
  expect(before).toEqual({ "3": 2 });
  expect(histogram(null, 0)).toEqual({ "0": 1 });
});

it("tally counts each drawn Question shown, and correct when right", () => {
  const drawn = [
    { id: "a", order: [0, 1] },
    { id: "b", order: [1, 0] },
  ];
  const before = { a: { shown: 2, correct: 1 } };
  expect(tally(before, drawn, ["b"])).toEqual({
    a: { shown: 3, correct: 1 },
    b: { shown: 1, correct: 1 },
  });
  expect(before).toEqual({ a: { shown: 2, correct: 1 } });
});

it("learnerQuestions follows the drawn order and never says which options are correct", () => {
  const pool = [q("a", "single", [true, false, false]), q("b", "truefalse", [false, true], true)];
  const shown = learnerQuestions(pool, [
    { id: "b", order: [0, 1] },
    { id: "a", order: [2, 0, 1] },
  ]);
  expect(shown).toEqual([
    {
      id: "b",
      type: "truefalse",
      text: "b",
      options: [
        { text: "o0", index: 0 },
        { text: "o1", index: 1 },
      ],
    },
    {
      id: "a",
      type: "single",
      text: "a",
      options: [
        { text: "o2", index: 2 },
        { text: "o0", index: 0 },
        { text: "o1", index: 1 },
      ],
    },
  ]);
  expect(JSON.stringify(shown)).not.toContain("correct");
});
