"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { correctMyName } from "@/app/me/actions";
import { MAX_NAME } from "@/domain/attempt";

/** Name correction for one Valid Certificate: the new name, then a replacement at a new id. */
export function CorrectName({ publicId, name }: { publicId: string; name: string }) {
  const t = useTranslations("mine");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<"name" | "invalid" | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return <button onClick={() => setOpen(true)}>{t("correct")}</button>;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setError((await correctMyName(publicId, value)) ?? null));
      }}
    >
      <label className="stack">
        {t("newName")}
        <input
          required
          maxLength={MAX_NAME}
          autoComplete="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="muted">{t("correctHint")}</p>
      {error && <p role="alert">{t(error === "name" ? "nameError" : "notCorrectable")}</p>}
      <div className="row">
        <button disabled={pending}>{t("save")}</button>
        <button type="button" onClick={() => setOpen(false)}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
