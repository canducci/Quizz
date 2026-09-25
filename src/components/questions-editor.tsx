"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  addQuestion,
  deleteQuestion,
  saveQuestion,
  uploadQuestionImage,
  type StoredQuestion,
} from "@/app/assessments/actions";
import {
  MAX_OPTIONS,
  normalizeQuestion,
  QUESTION_TYPES,
  questionProblems,
  type QuestionContent,
  type QuestionType,
} from "@/domain/question";
import { MAX_IMAGE_BYTES } from "@/server/image-type";
import { QuestionView } from "./question-view";

type SaveState = "idle" | "saving" | "saved" | "failed";

export function QuestionsEditor(props: { assessmentId: string; pool: StoredQuestion[] }) {
  const t = useTranslations("editor");
  const tl = useTranslations("attempt");
  const [questions, setQuestions] = useState(props.pool);
  const [selectedId, setSelectedId] = useState(props.pool[0]?.id);
  const [save, setSave] = useState<SaveState>("idle");
  const [imageError, setImageError] = useState<"badImage" | "tooLarge" | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Refreshes the server-rendered top bar (its Question count); local state survives.
  const router = useRouter();

  // Edits save the whole Question after a short pause, one request at a time, last write wins.
  const pending = useRef<StoredQuestion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chain = useRef(Promise.resolve());
  const flush = () => {
    clearTimeout(timer.current);
    const q = pending.current;
    pending.current = null;
    if (q) {
      chain.current = chain.current.then(async () => {
        const ok = await saveQuestion(q.id, q).catch(() => false);
        if (!pending.current) setSave(ok ? "saved" : "failed");
      });
    }
    return chain.current;
  };

  const index = questions.findIndex((q) => q.id === selectedId);
  const selected = questions[index];

  function edit(change: Partial<QuestionContent>) {
    const content = normalizeQuestion({ ...selected, ...change });
    if (!content) return; // Past the length limits.
    const next = { id: selected.id, ...content };
    setQuestions((qs) => qs.map((q) => (q.id === next.id ? next : q)));
    pending.current = next;
    setSave("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  }

  function setType(type: QuestionType) {
    // Going single keeps only the first correct option.
    const first = selected.options.findIndex((o) => o.correct);
    const options =
      type === "multi"
        ? selected.options
        : selected.options.map((o, i) => ({ ...o, correct: i === first }));
    edit({ type, options });
  }

  function markCorrect(i: number, checked: boolean) {
    edit({
      options: selected.options.map((o, j) =>
        selected.type === "multi"
          ? j === i
            ? { ...o, correct: checked }
            : o
          : { ...o, correct: j === i },
      ),
    });
  }

  async function add() {
    await flush();
    const added = await addQuestion(props.assessmentId, "single");
    if (!added) return setSave("failed");
    setQuestions((qs) => [...qs, added]);
    setSelectedId(added.id);
    router.refresh();
  }

  async function remove() {
    if (!confirm(t("confirmDelete", { n: index + 1 }))) return;
    await flush();
    await deleteQuestion(selected.id);
    setQuestions((qs) => qs.filter((q) => q.id !== selected.id));
    setSelectedId(questions[index + 1]?.id ?? questions[index - 1]?.id);
    router.refresh();
  }

  async function insertImage(file: File) {
    if (file.size > MAX_IMAGE_BYTES) return setImageError("tooLarge");
    const form = new FormData();
    form.set("image", file);
    const upload = await uploadQuestionImage(form);
    if ("error" in upload) return setImageError(upload.error);
    setImageError(null);
    const at = textRef.current?.selectionStart ?? selected.text.length;
    const image = `![${t("imageAlt")}](/files/${upload.key})`;
    edit({ text: selected.text.slice(0, at) + image + selected.text.slice(at) });
  }

  return (
    <div className="panes">
      <div className="pool">
        <ol aria-label={t("pool")}>
          {questions.map((q, i) => (
            <li key={q.id}>
              <button
                type="button"
                aria-current={q.id === selectedId}
                onClick={async () => {
                  await flush();
                  setSelectedId(q.id);
                }}
              >
                <span className="n">{i + 1}</span>
                <span>
                  {q.text.split("\n")[0].slice(0, 70) || t("untitled")}
                  <br />
                  <small>
                    {t(`types.${q.type}`)}
                    {questionProblems(q).length > 0 && (
                      <>
                        {" · "}
                        <span className="danger">{t("incomplete")}</span>
                      </>
                    )}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={add}>
          {t("newQuestion")}
        </button>
      </div>

      <div className="edit stack">
        {selected ? (
          <>
            <div className="row">
              <h2>{t("question", { n: index + 1 })}</h2>
              <p role="status">{save !== "idle" && t(`save.${save}`)}</p>
              <button type="button" className="danger" onClick={remove}>
                {t("delete")}
              </button>
            </div>
            <label className="stack">
              {t("type")}
              <select
                value={selected.type}
                onChange={(e) => setType(e.target.value as QuestionType)}
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              {t("text")}
              <textarea
                ref={textRef}
                rows={6}
                value={selected.text}
                onChange={(e) => edit({ text: e.target.value })}
              />
            </label>
            <label className="stack">
              {t("insertImage")}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) insertImage(file);
                }}
              />
            </label>
            {imageError && <p role="alert">{t(`imageErrors.${imageError}`)}</p>}
            <fieldset className="stack">
              <legend>{t("options")}</legend>
              {selected.options.map((o, i) => (
                <div key={i} className="row">
                  <input
                    type={selected.type === "multi" ? "checkbox" : "radio"}
                    name="correct"
                    checked={o.correct}
                    aria-label={t("correct", { n: i + 1 })}
                    onChange={(e) => markCorrect(i, e.target.checked)}
                  />
                  {selected.type === "truefalse" ? (
                    <span>{i === 0 ? tl("true") : tl("false")}</span>
                  ) : (
                    <>
                      <input
                        className="grow"
                        value={o.text}
                        aria-label={t("option", { n: i + 1 })}
                        onChange={(e) =>
                          edit({
                            options: selected.options.map((x, j) =>
                              j === i ? { ...x, text: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      {selected.options.length > 2 && (
                        <button
                          type="button"
                          aria-label={t("removeOption", { n: i + 1 })}
                          onClick={() =>
                            edit({ options: selected.options.filter((_, j) => j !== i) })
                          }
                        >
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              {selected.type !== "truefalse" && selected.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() =>
                    edit({ options: [...selected.options, { text: "", correct: false }] })
                  }
                >
                  {t("addOption")}
                </button>
              )}
              <small>{t(selected.type === "multi" ? "tickAll" : "pickOne")}</small>
            </fieldset>
            {selected.type !== "truefalse" && (
              <label>
                <input
                  type="checkbox"
                  checked={selected.keepOrder}
                  onChange={(e) => edit({ keepOrder: e.target.checked })}
                />{" "}
                {t("keepOrder")}
              </label>
            )}
            {questionProblems(selected).map((p) => (
              <p key={p} className="danger">
                {t(`problems.${p}`)}
              </p>
            ))}
          </>
        ) : (
          <p>{t("noQuestions")}</p>
        )}
      </div>

      <section className="learner" aria-label={t("preview")}>
        <p>{t("preview")}</p>
        {selected && (
          <>
            <QuestionView
              question={selected}
              labels={{
                heading: tl("heading", { n: index + 1 }),
                hint: {
                  single: tl("hint.single"),
                  multi: tl("hint.multi"),
                  truefalse: tl("hint.truefalse"),
                },
                true: tl("true"),
                false: tl("false"),
              }}
            />
            <p>
              <small>{t(selected.keepOrder ? "keptOrder" : "shuffled")}</small>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
