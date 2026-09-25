"use client";

import { startTransition, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveBranding } from "@/app/settings/actions";
import type { creator } from "@/db/schema";
import { DEFAULT_ACCENT, MAX_BRAND_TEXT } from "@/domain/publish";
import { MAX_IMAGE_BYTES } from "@/server/image-type";

export function BrandingForm({ creator: me }: { creator: typeof creator.$inferSelect }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState(saveBranding, { status: "idle" as const });
  const [tooLarge, setTooLarge] = useState(false);
  const status = tooLarge ? "tooLarge" : state.status;

  return (
    <form
      className="stack"
      // Submitting by hand, not via `action`, so React doesn't wipe the fields when saving fails.
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        // Past Next's body limit the action never runs, so catch big files before sending.
        const big = [...form.values()].some((v) => v instanceof File && v.size > MAX_IMAGE_BYTES);
        setTooLarge(big);
        if (!big) startTransition(() => action(form));
      }}
    >
      <label className="stack">
        {t("name")}
        <input name="name" required maxLength={MAX_BRAND_TEXT} defaultValue={me.name} />
      </label>
      <label className="stack">
        {t("accent")}
        <input name="accent" type="color" defaultValue={me.accentColour ?? DEFAULT_ACCENT} />
      </label>
      <label className="stack">
        {t("signerName")}
        <input name="signerName" maxLength={MAX_BRAND_TEXT} defaultValue={me.signerName ?? ""} />
      </label>
      <label className="stack">
        {t("signerTitle")}
        <input name="signerTitle" maxLength={MAX_BRAND_TEXT} defaultValue={me.signerTitle ?? ""} />
      </label>
      <ImageField name="logo" label={t("logo")} imageKey={me.logoKey} />
      <ImageField name="signature" label={t("signature")} imageKey={me.signatureKey} />
      <p>{t("imageHint")}</p>
      <button disabled={pending}>{t("save")}</button>
      {status === "saved" && <p role="status">{t("saved")}</p>}
      {status !== "idle" && status !== "saved" && <p role="alert">{t(`errors.${status}`)}</p>}
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
