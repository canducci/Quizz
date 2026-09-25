import { describe, expect, it } from "vitest";
import { normalizeQuestion, questionProblems, type QuestionContent } from "./question";

const q = (over: Partial<QuestionContent>): QuestionContent => ({
  type: "single",
  text: "What is 2 + 2?",
  options: [
    { text: "3", correct: false },
    { text: "4", correct: true },
  ],
  keepOrder: false,
  ...over,
});

describe("questionProblems", () => {
  it("finds nothing wrong with a complete Question", () => {
    expect(questionProblems(q({}))).toEqual([]);
  });

  it("flags missing text, too few options, empty options and no correct answer", () => {
    expect(questionProblems(q({ text: "  " }))).toEqual(["noText"]);
    expect(questionProblems(q({ options: [{ text: "4", correct: true }] }))).toEqual([
      "tooFewOptions",
    ]);
    expect(
      questionProblems(q({ options: [...q({}).options, { text: " ", correct: false }] })),
    ).toEqual(["emptyOption"]);
    expect(
      questionProblems(q({ options: q({}).options.map((o) => ({ ...o, correct: false })) })),
    ).toEqual(["noCorrect"]);
  });

  it("doesn't count a correct mark on an empty option", () => {
    const options = [
      { text: "3", correct: false },
      { text: "", correct: true },
    ];
    expect(questionProblems(q({ options }))).toEqual(["tooFewOptions", "emptyOption", "noCorrect"]);
  });

  it("allows several correct options only on multi-select Questions", () => {
    const options = q({}).options.map((o) => ({ ...o, correct: true }));
    expect(questionProblems(q({ type: "multi", options }))).toEqual([]);
    expect(questionProblems(q({ type: "single", options }))).toEqual(["tooManyCorrect"]);
  });

  it("needs no option text on true/false Questions", () => {
    const options = [
      { text: "", correct: false },
      { text: "", correct: true },
    ];
    expect(questionProblems(q({ type: "truefalse", options }))).toEqual([]);
  });
});

describe("normalizeQuestion", () => {
  it("keeps a well-formed Question, incomplete or not", () => {
    expect(normalizeQuestion(q({}))).toEqual(q({}));
    expect(normalizeQuestion(q({ text: "", options: [] }))).toEqual(q({ text: "", options: [] }));
  });

  it("refuses malformed input", () => {
    expect(normalizeQuestion(null)).toBeNull();
    expect(normalizeQuestion({ ...q({}), type: "essay" })).toBeNull();
    expect(normalizeQuestion({ ...q({}), text: 42 })).toBeNull();
    expect(normalizeQuestion({ ...q({}), text: "x".repeat(20_001) })).toBeNull();
    expect(normalizeQuestion({ ...q({}), options: [{ text: "a", correct: "yes" }] })).toBeNull();
    const nine = Array.from({ length: 9 }, (_, i) => ({ text: `${i}`, correct: false }));
    expect(normalizeQuestion({ ...q({}), options: nine })).toBeNull();
  });

  it("gives true/false Questions exactly two options, in order", () => {
    const tf = normalizeQuestion(q({ type: "truefalse", options: [{ text: "x", correct: true }] }));
    expect(tf).toEqual({
      type: "truefalse",
      text: "What is 2 + 2?",
      options: [
        { text: "", correct: true },
        { text: "", correct: false },
      ],
      keepOrder: true,
    });
  });
});
