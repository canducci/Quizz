import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, parseQuestionsCsv } from "./csv-import";

const HEADER = "type,question,option_1,option_2,option_3,correct,keep_order";
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseQuestionsCsv", () => {
  it("reads each Question type", () => {
    const result = parseQuestionsCsv(
      csv(
        "single,2 + 2?,3,4,,2,",
        "multi,Hooks?,useState,render,useEffect,1;3,yes",
        "truefalse,Is JSX HTML?,,,,false,",
      ),
    );
    expect(result).toEqual({
      questions: [
        {
          type: "single",
          text: "2 + 2?",
          options: [
            { text: "3", correct: false },
            { text: "4", correct: true },
          ],
          keepOrder: false,
        },
        {
          type: "multi",
          text: "Hooks?",
          options: [
            { text: "useState", correct: true },
            { text: "render", correct: false },
            { text: "useEffect", correct: true },
          ],
          keepOrder: true,
        },
        {
          type: "truefalse",
          text: "Is JSX HTML?",
          options: [
            { text: "", correct: false },
            { text: "", correct: true },
          ],
          keepOrder: true,
        },
      ],
    });
  });

  it("keeps Markdown with commas, quotes and newlines", () => {
    const text = 'What does this print?\n\n```js\nconsole.log("a, b");\n```';
    const result = parseQuestionsCsv(
      csv(`single,"${text.replaceAll('"', '""')}"," a, b","""a""",,1, YES `),
    );
    expect(result).toEqual({
      questions: [
        {
          type: "single",
          text,
          options: [
            { text: " a, b", correct: true },
            { text: '"a"', correct: false },
          ],
          keepOrder: true,
        },
      ],
    });
  });

  it("rejects bad correct values", () => {
    const result = parseQuestionsCsv(
      csv(
        "single,Q,a,b,,3,", // Past the last option.
        "single,Q,a,b,,x,",
        "single,Q,a,b,,,", // Nothing marked.
        "single,Q,a,,c,2,", // A blank option.
        "multi,Q,a,b,,true,",
        "truefalse,Q,,,,1,",
        "single,Q,a,b,,1;2,",
      ),
    );
    expect(result).toEqual({
      errors: [
        { row: 2, problem: "badCorrect" },
        { row: 3, problem: "badCorrect" },
        { row: 4, problem: "noCorrect" },
        { row: 5, problem: "badCorrect" },
        { row: 5, problem: "emptyOption" },
        { row: 6, problem: "badCorrect" },
        { row: 7, problem: "badCorrect" },
        { row: 8, problem: "tooManyCorrect" },
      ],
    });
  });

  it("rejects too many options, as a ninth column or as extra cells", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `option_${i + 1}`).join(",");
    expect(parseQuestionsCsv(`type,question,${nine},correct\nsingle,Q,a,b,,,,,,,,1`)).toEqual({
      errors: [{ row: 1, problem: "badHeader" }],
    });
    expect(parseQuestionsCsv(csv("single,Q,a,b,c,1,,extra"))).toEqual({
      errors: [{ row: 2, problem: "tooManyOptions" }],
    });
  });

  it("numbers rows as a spreadsheet does, even after a multi-line cell or a blank row", () => {
    const result = parseQuestionsCsv(
      csv('single,"line 1\nline 2",a,b,,1,', ",,,,,,", "essay,Q,a,b,,1,"),
    );
    expect(result).toEqual({ errors: [{ row: 4, problem: "badType" }] });
  });

  it("lists every error in the file", () => {
    const result = parseQuestionsCsv(csv("single,,a,,,1,", "single,Q,a,b,,1,maybe"));
    expect(result).toEqual({
      errors: [
        { row: 2, problem: "noText" },
        { row: 2, problem: "tooFewOptions" },
        { row: 3, problem: "badKeepOrder" },
      ],
    });
  });

  it("rejects a file without Questions, a bad header, an open quote or a text too long", () => {
    expect(parseQuestionsCsv(HEADER)).toEqual({ errors: [{ row: 1, problem: "noRows" }] });
    expect(parseQuestionsCsv(csv(...Array(1001).fill("truefalse,Q,,,,true,")))).toEqual({
      errors: [{ row: 1, problem: "tooManyRows" }],
    });
    expect(parseQuestionsCsv("")).toEqual({ errors: [{ row: 1, problem: "badHeader" }] });
    expect(parseQuestionsCsv("type,question\nsingle,Q")).toEqual({
      errors: [{ row: 1, problem: "badHeader" }],
    });
    expect(parseQuestionsCsv(csv('single,"Q,a,b,,1,'))).toEqual({
      errors: [{ row: 2, problem: "openQuote" }],
    });
    expect(parseQuestionsCsv(csv(`single,${"x".repeat(20_001)},a,b,,1,`))).toEqual({
      errors: [{ row: 2, problem: "tooLong" }],
    });
  });

  it("accepts a byte order mark, CRLF line ends and header case", () => {
    const result = parseQuestionsCsv(`﻿${HEADER.toUpperCase()}\r\nsingle,Q,a,b,,1,\r\n`);
    expect("questions" in result && result.questions).toHaveLength(1);
  });

  it("accepts its own template", () => {
    const result = parseQuestionsCsv(CSV_TEMPLATE);
    expect(result).toHaveProperty("questions");
    expect("questions" in result && result.questions.map((q) => q.type)).toEqual([
      "single",
      "multi",
      "truefalse",
    ]);
  });
});
