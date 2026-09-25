"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  changeInvites,
  saveAccess,
  saveRules,
  type InviteState,
  type SettingsState,
} from "@/app/assessments/actions";
import type { assessment } from "@/db/schema";
import { RANGES } from "@/domain/settings";
import { locales } from "@/i18n/locales";

type Assessment = typeof assessment.$inferSelect;
const EXPIRY_CHOICES = [30, 90, 365, 730];

/** Saves by hand, not via `action`, so React doesn't wipe the fields when saving fails. */
function SettingsForm(props: {
  save: (state: SettingsState, form: FormData) => Promise<SettingsState>;
  children: ReactNode;
}) {
  const t = useTranslations("settingsTabs");
  const [state, action, pending] = useActionState<SettingsState, FormData>(props.save, {
    status: "idle",
  });
  return (
    <form
      className="settings"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(() => action(form));
      }}
    >
      {props.children}
      <div className="row">
        <button disabled={pending}>{t("save")}</button>
        {state.status === "saved" && <p role="status">{t("saved")}</p>}
        {state.status === "invalid" && <p role="alert">{t("invalid")}</p>}
      </div>
    </form>
  );
}

function Field(props: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="setting">
      <span>
        <b>{props.label}</b>
        <span className="muted">{props.hint}</span>
      </span>
      <span>{props.children}</span>
    </label>
  );
}

export function RulesForm({
  assessment: a,
  poolSize,
}: {
  assessment: Assessment;
  poolSize: number;
}) {
  const t = useTranslations("settingsTabs.rules");
  const num = (name: Exclude<keyof typeof RANGES, "expiryDays">) => (
    <input
      name={name}
      type="number"
      required
      min={RANGES[name][0]}
      max={RANGES[name][1]}
      step={1}
      defaultValue={a[name] as number}
    />
  );
  return (
    <SettingsForm save={saveRules.bind(null, a.id)}>
      <Field label={t("drawn")} hint={t("drawnHint", { n: poolSize })}>
        {num("drawn")} {t("questions")}
      </Field>
      <Field label={t("timeLimit")} hint={t("timeLimitHint")}>
        {num("timeLimit")} {t("minutes")}
      </Field>
      <Field label={t("passingScore")} hint={t("passingScoreHint")}>
        {num("passingScore")} %
      </Field>
      <Field label={t("maxAttempts")} hint={t("maxAttemptsHint")}>
        {num("maxAttempts")} {t("perLearner")}
      </Field>
      <Field label={t("cooldown")} hint={t("cooldownHint")}>
        {num("cooldown")} {t("minutes")}
      </Field>
      <Field label={t("expiry")} hint={t("expiryHint")}>
        <select name="expiryDays" defaultValue={a.expiryDays ?? ""}>
          <option value="">{t("never")}</option>
          {EXPIRY_CHOICES.map((d) => (
            <option key={d} value={d}>
              {t("days", { n: d })}
            </option>
          ))}
        </select>
      </Field>
    </SettingsForm>
  );
}

export function AccessForm({
  assessment: a,
  invited,
}: {
  assessment: Assessment;
  invited: number;
}) {
  const t = useTranslations("settingsTabs.access");
  return (
    <>
      <SettingsForm save={saveAccess.bind(null, a.id)}>
        <Field label={t("language")} hint={t("languageHint")}>
          <select name="language" defaultValue={a.language}>
            {locales.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("accessMode")} hint={t("accessModeHint")}>
          <select name="accessMode" defaultValue={a.accessMode}>
            <option value="public">{t("public")}</option>
            <option value="invite">{t("invite")}</option>
          </select>
        </Field>
      </SettingsForm>
      {a.accessMode === "invite" && <Invites assessmentId={a.id} invited={invited} />}
    </>
  );
}

function Invites({ assessmentId, invited }: { assessmentId: string; invited: number }) {
  const t = useTranslations("settingsTabs.access");
  const [state, action, pending] = useActionState<InviteState, FormData>(
    changeInvites.bind(null, assessmentId),
    { status: "idle" },
  );
  // Submitted through `action` on purpose: React clears the pasted emails afterwards.
  return (
    <form className="settings" action={action}>
      <h2>{t("invited", { n: invited })}</h2>
      <p className="muted">{t("invitesHint")}</p>
      <label className="stack">
        {t("emails")}
        <textarea name="emails" rows={6} required />
      </label>
      <div className="row">
        <button name="op" value="add" disabled={pending}>
          {t("add")}
        </button>
        <button name="op" value="remove" disabled={pending}>
          {t("remove")}
        </button>
        {state.status !== "idle" && (
          <p role="status">
            {t(state.status, { n: state.changed })}
            {state.invalid > 0 && ` ${t("skipped", { n: state.invalid })}`}
          </p>
        )}
      </div>
    </form>
  );
}
