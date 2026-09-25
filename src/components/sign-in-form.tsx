"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/server/auth-client";

export function SignInForm({ google }: { google: boolean }) {
  const t = useTranslations("signIn");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [email, setEmail] = useState("");

  if (status === "sent") return <p role="status">{t("sent", { email })}</p>;

  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus("sending");
          const { error } = await authClient.signIn.magicLink({
            email,
            callbackURL: "/dashboard",
            errorCallbackURL: "/?error=signIn",
          });
          setStatus(error ? "failed" : "sent");
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
        <button disabled={status === "sending"}>{t("sendLink")}</button>
        {status === "failed" && <p role="alert">{t("failed")}</p>}
      </form>
      {google && (
        <>
          <p>{t("or")}</p>
          <button
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
                errorCallbackURL: "/?error=signIn",
              })
            }
          >
            {t("google")}
          </button>
        </>
      )}
    </div>
  );
}
