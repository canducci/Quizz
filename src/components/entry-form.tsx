"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CODE_MINUTES } from "@/domain/one-time-code";
import type { EntryError } from "@/app/a/[id]/actions";

/** Email, then the one-time code. A verified Learner reloads into the page's verified view.
 * `request` and `verify` are the page's server actions. */
export function EntryForm({
  request,
  verify,
}: {
  request: (email: string) => Promise<EntryError | null>;
  verify: (email: string, code: string) => Promise<EntryError | null>;
}) {
  const t = useTranslations("learner");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<EntryError | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      const failed = await request(email);
      setError(failed);
      if (!failed) {
        setSent(true);
        setCode("");
      }
    });

  const alert = error && <p role="alert">{t(`errors.${error.reason}`, error)}</p>;

  if (!sent)
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="stack">
          {t("email")}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <p className="muted">{t("emailHint")}</p>
        {alert}
        <div className="row">
          <button disabled={pending}>{t("sendCode")}</button>
        </div>
      </form>
    );

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const failed = await verify(email, code);
          setError(failed);
          if (!failed) router.refresh();
        });
      }}
    >
      <h2>{t("codeTitle")}</h2>
      <p className="muted">{t("sentTo", { email, minutes: CODE_MINUTES })}</p>
      <label className="stack">
        {t("code")}
        <input
          className="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      {alert}
      <div className="row">
        <button disabled={pending}>{t("verify")}</button>
        <button type="button" disabled={pending} onClick={send}>
          {t("resendCode")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
        >
          {t("otherEmail")}
        </button>
      </div>
    </form>
  );
}
