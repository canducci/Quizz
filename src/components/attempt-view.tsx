"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  resendLearnerCertificate,
  saveLearnerAnswer,
  startLearnerAttempt,
  submitLearnerAttempt,
} from "@/app/a/[id]/actions";
import type { EntryError } from "@/domain/one-time-code";
import { MAX_NAME, type Answers, type LearnerQuestion } from "@/domain/attempt";
import { QuestionView, questionLabels } from "./question-view";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
  const mmss = `${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
  return h ? `${h}:${mmss}` : mmss;
};

/** Starts an Attempt, or resumes the running one; the page then shows it. */
export function StartButton({ assessmentId, again }: { assessmentId: string; again: boolean }) {
  const t = useTranslations("learner");
  const router = useRouter();
  const [error, setError] = useState<EntryError | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack">
      {error && <CantStart error={error} />}
      <div className="row">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const failed = await startLearnerAttempt(assessmentId);
              setError(failed);
              if (!failed) router.refresh();
            })
          }
        >
          {t(again ? "startAgain" : "start")}
        </button>
      </div>
    </div>
  );
}

/** Why the Learner can't start; a held Certificate is linked, with when it can be renewed. */
export function CantStart({ error }: { error: EntryError }) {
  const t = useTranslations("learner");
  return (
    <p role="alert">
      {t(`errors.${error.reason}`, error)}
      {error.reason === "certificateHeld" && (
        <>
          {" "}
          <a href={`/c/${error.publicId}`}>{t("viewCertificate")}</a>
          {error.renewFrom && <> {t("renewFrom", { until: error.renewFrom })}</>}
        </>
      )}
    </p>
  );
}

/** Emails the Learner's Certificate again, for one that didn't arrive. */
export function ResendButton({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("learner");
  const [outcome, setOutcome] = useState<"sent" | "dailyCap" | "sendFailed" | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack">
      {outcome === "sent" ? (
        <p role="status">{t("resent")}</p>
      ) : (
        outcome && (
          <p role="alert">
            {t(`errors.${outcome === "sendFailed" ? "certificateSendFailed" : outcome}`)}
          </p>
        )
      )}
      <div className="row">
        <button
          className="link"
          disabled={pending}
          onClick={() =>
            startTransition(async () => setOutcome(await resendLearnerCertificate(assessmentId)))
          }
        >
          {t("resend")}
        </button>
      </div>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "failed";

/** A running Attempt (Variant D): sidebar with clock and question squares, one Question at a time,
 * then the review page with the name and Submit. The server holds the clock and every answer. */
export function AttemptView(props: {
  assessmentId: string;
  creator: string;
  title: string;
  questions: LearnerQuestion[];
  answers: Answers;
  remainingMs: number;
}) {
  const { assessmentId, questions } = props;
  const t = useTranslations("learner");
  const tAttempt = useTranslations("attempt");
  const router = useRouter();
  const [answers, setAnswers] = useState(props.answers);
  const [current, setCurrent] = useState<number | "review">(0);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The deadline as this browser's clock sees it, from the time left when the server rendered.
  const [endsAt] = useState(() => Date.now() + props.remainingMs);
  const [left, setLeft] = useState(props.remainingMs);
  useEffect(() => {
    const tick = setInterval(() => {
      const ms = endsAt - Date.now();
      setLeft(ms);
      // The server times the Attempt out when it next reads it.
      if (ms <= 0) {
        clearInterval(tick);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [endsAt, router]);

  // Each change saves that Question's whole choice, one request at a time. Failed ones stay unsaved
  // and go again with the next save or before Submit.
  const unsaved = useRef(new Map<string, number[]>());
  const queue = useRef(Promise.resolve());
  const flush = () => {
    queue.current = queue.current.then(async () => {
      for (const [id, choice] of [...unsaved.current]) {
        const ok = await saveLearnerAnswer(assessmentId, id, choice).catch(() => false);
        if (!ok) return setSaveState("failed");
        if (unsaved.current.get(id) === choice) unsaved.current.delete(id);
      }
      if (!unsaved.current.size) setSaveState("saved");
    });
    return queue.current;
  };
  const choose = (id: string, choice: number[]) => {
    setAnswers((a) => ({ ...a, [id]: choice }));
    unsaved.current.set(id, choice);
    setSaveState("saving");
    flush();
  };

  const isAnswered = (id: string) => !!answers[id]?.length;
  const answered = questions.filter((q) => isAnswered(q.id)).length;
  const q = current === "review" ? null : questions[current];

  const submit = () =>
    startTransition(async () => {
      await flush();
      if (unsaved.current.size) return setError(t("errors.unsaved"));
      const result = await submitLearnerAttempt(assessmentId, name);
      if (!result.ok) return setError(t(`errors.${result.reason}`));
      if (result.mailed) router.refresh();
      else router.replace("?unsent=1");
    });

  return (
    <div className="learn attempt">
      <aside>
        <div>
          <b>{props.creator}</b>
          <div className="muted">{props.title}</div>
        </div>
        <div className="clock" role="timer" aria-label={t("clockLabel")}>
          <b>{clock(left)}</b>
          <span>{t("clock")}</span>
        </div>
        <div>
          <div className="muted">{t("progress", { answered, total: questions.length })}</div>
          <div className="squares">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                className={isAnswered(x.id) ? "done" : undefined}
                aria-current={i === current ? "step" : undefined}
                aria-label={t("square", { n: i + 1, answered: String(isAnswered(x.id)) })}
                onClick={() => setCurrent(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <p role="status" className="muted">
          {saveState !== "idle" && t(`save.${saveState}`)}
        </p>
        <button type="button" onClick={() => setCurrent("review")}>
          {t("review")}
        </button>
      </aside>

      {q && current !== "review" ? (
        <div className="stack">
          <QuestionView
            question={q}
            labels={questionLabels(tAttempt, t("of", { n: current + 1, total: questions.length }))}
            chosen={answers[q.id]}
            onChoose={(choice) => choose(q.id, choice)}
          />
          <div className="pager">
            {current > 0 ? (
              <button type="button" onClick={() => setCurrent(current - 1)}>
                {t("previous")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setCurrent(current + 1 < questions.length ? current + 1 : "review")}
            >
              {current + 1 < questions.length ? t("next") : t("review")}
            </button>
          </div>
        </div>
      ) : (
        <form
          className="paper stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>{t("reviewTitle")}</h2>
          <table>
            <tbody>
              {questions.map((x, i) => (
                <tr key={x.id}>
                  <td>{tAttempt("heading", { n: i + 1 })}</td>
                  <td className={isAnswered(x.id) ? undefined : "missing"}>
                    {t(isAnswered(x.id) ? "answered" : "unanswered")}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link"
                      aria-label={t("changeQuestion", { n: i + 1 })}
                      onClick={() => setCurrent(i)}
                    >
                      {t("change")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="stack">
            <b>{t("name")}</b>
            <input
              required
              maxLength={MAX_NAME}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="muted">{t("nameHint")}</p>
          {error && <p role="alert">{error}</p>}
          <div className="row">
            <button disabled={pending}>{t("submit")}</button>
            <button type="button" onClick={() => setCurrent(0)}>
              {t("back")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
