import type { QuestionContent } from "@/domain/question";
import { Markdown } from "./markdown";

/** Words the Learner sees, in the Assessment Language rather than the interface language. */
export type QuestionLabels = {
  heading: string;
  hint: Record<QuestionContent["type"], string>;
  true: string;
  false: string;
};

/** One Question as a Learner sees it in an Attempt; the editor preview renders the same thing. */
export function QuestionView({
  question,
  labels,
}: {
  question: QuestionContent;
  labels: QuestionLabels;
}) {
  const multi = question.type === "multi";
  return (
    <div className="paper">
      <div className="qhead">
        <span>{labels.heading}</span>
        <span>{labels.hint[question.type]}</span>
      </div>
      <div className="qt">
        <Markdown source={question.text} />
      </div>
      {question.options.map((o, i) => (
        <label key={i} className="option">
          <input type={multi ? "checkbox" : "radio"} name="answer" disabled />
          {question.type === "truefalse" ? (
            [labels.true, labels.false][i]
          ) : (
            <Markdown source={o.text} />
          )}
        </label>
      ))}
    </div>
  );
}
