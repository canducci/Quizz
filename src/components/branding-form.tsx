"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveBranding } from "@/app/settings/actions";
import type { creator } from "@/db/schema";

const DEFAULT_ACCENT = "#1f6feb";

export function BrandingForm({ creator: me }: { creator: typeof creator.$inferSelect }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState(saveBranding, { status: "idle" as const });

  return (
    <form action={action} className="stack">
      <label className="stack">
        {t("name")}
        <input name="name" required defaultValue={me.name} />
      </label>
      <label className="stack">
        {t("accent")}
        <input name="accent" type="color" defaultValue={me.accentColour ?? DEFAULT_ACCENT} />
      </label>
      <label className="stack">
        {t("signerName")}
        <input name="signerName" defaultValue={me.signerName ?? ""} />
      </label>
      <label className="stack">
        {t("signerTitle")}
        <input name="signerTitle" defaultValue={me.signerTitle ?? ""} />
      </label>
      <ImageField name="logo" label={t("logo")} imageKey={me.logoKey} />
      <ImageField name="signature" label={t("signature")} imageKey={me.signatureKey} />
      <p>{t("imageHint")}</p>
      <button disabled={pending}>{t("save")}</button>
      {state.status === "saved" && <p role="status">{t("saved")}</p>}
      {state.status !== "idle" && state.status !== "saved" && (
        <p role="alert">{t(`errors.${state.status}`)}</p>
      )}
    </form>
  );
}

function ImageField(props: { name: string; label: string; imageKey: string | null }) {
  return (
    <label className="stack">
      {props.label}
      {props.imageKey && (
        // eslint-disable-next-line @next/next/no-img-element -- files are served as-is from /files
        <img src={`/files/${props.imageKey}`} alt={props.label} className="preview" />
      )}
      <input name={props.name} type="file" accept="image/png,image/jpeg" />
    </label>
  );
}
