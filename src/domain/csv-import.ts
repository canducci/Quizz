import {
  MAX_OPTIONS,
  normalizeQuestion,
  QUESTION_TYPES,
  questionProblems,
  type QuestionContent,
  type QuestionProblem,
  type QuestionType,
} from "./question";

const OPTION_COLUMNS = Array.from({ length: MAX_OPTIONS }, (_, i) => `option_${i + 1}`);
const COLUMNS = ["type", "question", ...OPTION_COLUMNS, "correct", "keep_order"];
const REQUIRED = ["type", "question", "correct"];
/** Keeps one import to one insert, well under SQLite's bound-variable limit. */
export const MAX_IMPORT_ROWS = 1000;
/** Checked in the browser too: a file past the body size limit never reaches the server. */
export const MAX_CSV_BYTES = 1024 * 1024;

export type ImportProblem =
  | QuestionProblem
  | "badHeader"
  | "noRows"
  | "tooManyRows"
  | "tooLarge"
  | "openQuote"
  | "badType"
  | "badCorrect"
  | "badKeepOrder"
  | "tooManyOptions"
  | "tooLong";
/** Rows are numbered as in a spreadsheet: the header is row 1. */
export type ImportError = { row: number; problem: ImportProblem };

export const CSV_TEMPLATE = `${COLUMNS.join(",")}
single,What is 2 + 2?,3,4,5,,,,,,2,yes
multi,"Which are React hooks?

Tick every one.",useState,render,useEffect,,,,,,1;3,
truefalse,"\`useEffect\` runs after render, by default.",,,,,,,,,true,
`;

/** RFC 4180 records, or the row where a quoted cell never closes. */
function parseCsv(text: string): string[][] | { openAt: number } {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') cell += text[i++];
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      record.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      records.push([...record, cell]);
      record = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) return { openAt: records.length + 1 };
  if (cell || record.length) records.push([...record, cell]);
  return records;
}

function readRow(cells: string[], columns: string[]): QuestionContent | ImportProblem[] {
  if (cells.length > columns.length) return ["tooManyOptions"];
  const cell = (name: string) => cells[columns.indexOf(name)] ?? "";
  const type = cell("type").trim().toLowerCase() as QuestionType;
  if (!QUESTION_TYPES.includes(type)) return ["badType"];
  const problems: ImportProblem[] = [];
  const keep = cell("keep_order").trim().toLowerCase();
  if (keep && keep !== "yes") problems.push("badKeepOrder");

  // Markdown keeps its whitespace; only the codes are trimmed.
  const texts = OPTION_COLUMNS.map(cell);
  const correct = cell("correct").trim().toLowerCase();
  let marks: boolean[];
  if (type === "truefalse") {
    marks = [correct === "true", correct === "false"];
    if (correct && !marks.includes(true)) problems.push("badCorrect");
  } else {
    const count = texts.findLastIndex((t) => t.trim()) + 1;
    const picked = correct ? correct.split(";").map((p) => p.trim()) : [];
    const valid = picked.every((p) => /^\d+$/.test(p) && +p <= count && texts[+p - 1]?.trim());
    if (!valid) problems.push("badCorrect");
    marks = texts.slice(0, count).map((_, i) => valid && picked.some((p) => +p === i + 1));
  }

  const content = normalizeQuestion({
    type,
    text: cell("question"),
    options: marks.map((m, i) => ({ text: type === "truefalse" ? "" : texts[i], correct: m })),
    keepOrder: keep === "yes",
  });
  if (!content) return [...problems, "tooLong"];
  // A bad `correct` already explains why nothing is marked.
  const badCorrect = problems.includes("badCorrect");
  problems.push(...questionProblems(content).filter((p) => !(badCorrect && p === "noCorrect")));
  return problems.length ? problems : content;
}

/** All or nothing: every Question in the file, or every error in it. */
export function parseQuestionsCsv(
  text: string,
): { questions: QuestionContent[] } | { errors: ImportError[] } {
  const parsed = parseCsv(text.replace(/^﻿/, ""));
  if (!Array.isArray(parsed)) return { errors: [{ row: parsed.openAt, problem: "openQuote" }] };
  const [header = [], ...rows] = parsed;
  const columns = header.map((h) => h.trim().toLowerCase());
  const headerOk =
    columns.every((c) => COLUMNS.includes(c)) &&
    new Set(columns).size === columns.length &&
    REQUIRED.every((c) => columns.includes(c));
  if (!headerOk) return { errors: [{ row: 1, problem: "badHeader" }] };

  const questions: QuestionContent[] = [];
  const errors: ImportError[] = [];
  rows.forEach((cells, i) => {
    if (cells.every((c) => !c.trim())) return;
    const read = readRow(cells, columns);
    if (Array.isArray(read)) errors.push(...read.map((problem) => ({ row: i + 2, problem })));
    else questions.push(read);
  });
  if (errors.length) return { errors };
  if (!questions.length) return { errors: [{ row: 1, problem: "noRows" }] };
  if (questions.length > MAX_IMPORT_ROWS) return { errors: [{ row: 1, problem: "tooManyRows" }] };
  return { questions };
}
