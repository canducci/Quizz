import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { formatId, longDate, shownStatus } from "@/domain/certificate";
import { requireCreator } from "@/server/auth";
import { MAX_REASON, creatorCertificates } from "@/server/certificates";
import { revoke } from "./actions";

/** Where a Creator finds one of their Certificates and revokes it. */
export default async function Certificates(props: {
  searchParams: Promise<{ q?: string; done?: string }>;
}) {
  const me = await requireCreator();
  const { q = "", done } = await props.searchParams;
  const t = await getTranslations("certificates");
  const locale = await getLocale();
  const found = q.trim() ? await creatorCertificates(db, me.id, q) : undefined;
  const now = new Date();

  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      <form className="row">
        <input
          name="q"
          required
          defaultValue={q}
          aria-label={t("search")}
          placeholder={t("search")}
          size={50}
        />
        <button>{t("find")}</button>
      </form>
      {done && <p role="status">{t(done === "revoked" ? "revoked" : "failed")}</p>}
      {found === null && <p role="alert">{t("badSearch")}</p>}
      {found?.length === 0 && <p>{t("none")}</p>}
      {found?.map((c) => {
        const { status, since } = shownStatus(c, now);
        return (
          <article key={c.publicId} className="card stack" aria-label={formatId(c.publicId)}>
            <div>
              <b>{c.holderName}</b> · {c.version.snapshot.title} ·{" "}
              {t("version", { n: c.version.number })}
            </div>
            <div className="muted">
              <a className="mono" href={`/c/${c.publicId}`}>
                {formatId(c.publicId)}
              </a>{" "}
              · {t("issued", { date: longDate(c.issuedAt, locale) })} · {c.score}%
            </div>
            <div>
              {t(`status.${status}`, { date: since ? longDate(since, locale) : "" })}
              {c.revocationReason && ` · ${t("reason", { reason: c.revocationReason })}`}
            </div>
            {c.status === "valid" && (
              <form action={revoke} className="row">
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="publicId" value={c.publicId} />
                <input
                  name="reason"
                  required
                  maxLength={MAX_REASON}
                  aria-label={t("reasonLabel")}
                  placeholder={t("reasonLabel")}
                  size={40}
                />
                <button>{t("revoke")}</button>
              </form>
            )}
          </article>
        );
      })}
      <p className="muted">{t("privacy")}</p>
    </section>
  );
}
