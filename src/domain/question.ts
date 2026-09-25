export const QUESTION_TYPES = ["single", "multi", "truefalse"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const MAX_OPTIONS = 8;
const MAX_TEXT = 20_000;

/** True/false options are stored by index: 0 is True, 1 is False. Their text is unused. */
export type QuestionOption = { text: string; correct: boolean };
export type QuestionContent = {
  type: QuestionType;
  text: string;
  options: QuestionOption[];
  keepOrder: boolean;
};

/** Several answers tick boxes; one answer picks a radio. */
export const answerInput = (type: QuestionType) => (type === "multi" ? "checkbox" : "radio");

export type QuestionProblem =
  "noText" | "tooFewOptions" | "emptyOption" | "noCorrect" | "tooManyCorrect";

/** What stops a Question from being published. Codes, so the UI and CSV import can word them. */
export function questionProblems(q: QuestionContent): QuestionProblem[] {
  const problems: QuestionProblem[] = [];
  const filled = q.type === "truefalse" ? q.options : q.options.filter((o) => o.text.trim());
  const correct = filled.filter((o) => o.correct).length;
  if (!q.text.trim()) problems.push("noText");
  if (filled.length < 2) problems.push("tooFewOptions");
  if (filled.length < q.options.length) problems.push("emptyOption");
  if (correct === 0) problems.push("noCorrect");
  if (correct > 1 && q.type !== "multi") problems.push("tooManyCorrect");
  return problems;
}

const isString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

/** The Question as the editor may store it, or null when the input is malformed. Incomplete is fine. */
export function normalizeQuestion(input: unknown): QuestionContent | null {
  if (typeof input !== "object" || input === null) return null;
  const { type, text, options, keepOrder } = input as Record<string, unknown>;
  if (!QUESTION_TYPES.includes(type as QuestionType) || !isString(text, MAX_TEXT)) return null;
  if (!Array.isArray(options) || options.length > MAX_OPTIONS) return null;
  const clean: QuestionOption[] = [];
  for (const o of options) {
    if (typeof o !== "object" || o === null) return null;
    if (!isString(o.text, MAX_TEXT) || typeof o.correct !== "boolean") return null;
    clean.push({ text: o.text, correct: o.correct });
  }
  if (type === "truefalse") {
    const trueCorrect = clean[0]?.correct ?? false;
    return {
      type,
      text,
      options: [
        { text: "", correct: trueCorrect },
        { text: "", correct: !trueCorrect && (clean[1]?.correct ?? false) },
      ],
      keepOrder: true,
    };
  }
  return { type: type as QuestionType, text, options: clean, keepOrder: keepOrder === true };
}
