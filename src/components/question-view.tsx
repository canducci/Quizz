import type { LearnerQuestion } from "@/domain/attempt";
import { answerInput, type QuestionContent } from "@/domain/question";
import { Markdown } from "./markdown";

/** Words the Learner sees, in the Assessment Language rather than the interface language. */
export type QuestionLabels = {
  heading: string;
  hint: Record<QuestionContent["type"], string>;
  true: string;
  false: string;
};

/** The labels from the `attempt` messages of the Assessment Language. */
export const questionLabels = (
  t: (key: "hint.single" | "hint.multi" | "hint.truefalse" | "true" | "false") => string,
  heading: string,
): QuestionLabels => ({
  heading,
  hint: { single: t("hint.single"), multi: t("hint.multi"), truefalse: t("hint.truefalse") },
  true: t("true"),
  false: t("false"),
});

/** One Question as a Learner sees it in an Attempt; the editor preview renders the same thing,
 * read-only. `chosen` and `onChoose` use the options' original indices. */
export function QuestionView({
  question,
  labels,
  chosen = [],
  onChoose,
}: {
  question: Omit<LearnerQuestion, "id">;
  labels: QuestionLabels;
  chosen?: number[];
  onChoose?: (choice: number[]) => void;
}) {
  const input = answerInput(question.type);
  return (
    <div className="paper">
      <div className="qhead">
        <span>{labels.heading}</span>
        <span>{labels.hint[question.type]}</span>
      </div>
      <div className="qt">
        <Markdown source={question.text} />
      </div>
      {question.options.map((o) => (
        <label key={o.index} className="option">
          <input
            type={input}
            name="answer"
            disabled={!onChoose}
            checked={chosen.includes(o.index)}
            onChange={(e) =>
              onChoose?.(
                input === "radio"
                  ? [o.index]
                  : e.target.checked
                    ? [...chosen, o.index]
                    : chosen.filter((i) => i !== o.index),
              )
            }
          />
          {question.type === "truefalse" ? (
            [labels.true, labels.false][o.index]
          ) : (
            <Markdown source={o.text} />
          )}
        </label>
      ))}
    </div>
  );
}
