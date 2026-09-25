import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { EntryForm } from "@/components/entry-form";
import { CorrectName, EraseButton } from "@/components/my-certificates";
import { formatId, longDate, shownStatus } from "@/domain/certificate";
import { learnerCertificates } from "@/server/certificates";
import { emailHash } from "@/server/email-hash";
import { MINE, MINE_COOKIE, learnerEmail } from "@/server/learner-session";
import { forgetMe, requestMyCode, verifyMyCode } from "./actions";

const DONE = ["corrected", "unsent", "erased"] as const;

/** My Certificates: every Certificate issued to a verified email, across Creators, with name
 * correction and Learner Erasure. In the interface language; each Certificate's own title stays
 * in its Assessment Language. */
export default async function MyCertificates(props: { searchParams: Promise<{ done?: string }> }) {
  const t = await getTranslations("mine");
  const locale = await getLocale();
  const asked = (await props.searchParams).done;
  const done = DONE.find((d) => d === asked);
  const email = learnerEmail((await cookies()).get(MINE_COOKIE)?.value, MINE);
  const status = done && <p role="status">{t(done)}</p>;

  if (!email)
    return (
      <section className="stack">
        <h1>{t("title")}</h1>
        {status}
        <p className="muted">{t("intro")}</p>
        <EntryForm request={requestMyCode} verify={verifyMyCode} />
      </section>
    );

  const now = new Date();
  const certificates = await learnerCertificates(db, emailHash(email));
  return (
    <section className="stack">
      <h1>{t("title")}</h1>
      {status}
      <div className="row">
        <p>{t("verified", { email })}</p>
        <form action={forgetMe}>
          <button>{t("signOut")}</button>
        </form>
      </div>
      {!certificates.length && <p>{t("none")}</p>}
      {certificates.map((c) => {
        const shown = shownStatus(c, now);
        const { snapshot } = c.version;
        return (
          <article key={c.publicId} className="card stack" aria-label={formatId(c.publicId)}>
            <div>
              <b lang={snapshot.settings.language}>{snapshot.title}</b> · {snapshot.branding.name} ·{" "}
              {t("version", { n: c.version.number })}
            </div>
            <div>
              {c.holderName} · {c.score}% · {t("issued", { date: longDate(c.issuedAt, locale) })}
            </div>
            <div>
              {t(`status.${shown.status}`, {
                date: shown.since ? longDate(shown.since, locale) : "",
              })}{" "}
              · <a href={`/c/${c.publicId}`}>{t("view")}</a>{" "}
              <span className="mono muted">{formatId(c.publicId)}</span>
            </div>
            {shown.status === "valid" && <CorrectName publicId={c.publicId} name={c.holderName} />}
          </article>
        );
      })}
      <EraseButton />
    </section>
  );
}
