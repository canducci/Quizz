/* eslint-disable @next/next/no-img-element -- files are served as-is from /files */
import localFont from "next/font/local";
import { getLocale, getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { db } from "@/db";
import {
  formatId,
  longDate,
  nameSize,
  parsePublicId,
  shownStatus,
  verificationUrl,
} from "@/domain/certificate";
import { DEFAULT_ACCENT } from "@/domain/publish";
import { serifWidth } from "@/server/certificate-pdf";
import { verifiedCertificate } from "@/server/certificates";

// The PDF's own fonts, so the drawing matches it. next/font names each family after its variable,
// so these mustn't be called serif or sans: those are CSS generic families.
const sourceSerif = localFont({ src: "../../../../fonts/SourceSerif4-Regular.ttf" });
const sourceSans = localFont({
  src: [
    { path: "../../../../fonts/SourceSans3-Regular.ttf", weight: "400" },
    { path: "../../../../fonts/SourceSans3-Bold.ttf", weight: "700" },
  ],
});

const ICONS = { valid: "✓", expired: "⏱", revoked: "✕", replaced: "↻", notFound: "?" };

/** The public Verification Page (Variant B). Labels follow the viewer's interface language; the
 * Certificate itself stays in its Assessment Language, as on the PDF. */
export default async function VerificationPage(props: { params: Promise<{ id: string }> }) {
  const typed = decodeURIComponent((await props.params).id);
  const publicId = parsePublicId(typed);
  const found = publicId && (await verifiedCertificate(db, publicId));
  const t = await getTranslations("verify");
  const ui = await getLocale();

  if (!found)
    return (
      <div className="verify">
        <p className="muted">{typed}</p>
        <Status tone="bad" icon={ICONS.notFound} title={t("notFound")} sub={t("notFoundSub")} />
      </div>
    );

  const { version, ...cert } = found;
  const { snapshot } = version;
  const { branding, settings } = snapshot;
  const locale = settings.language;
  const c = await getTranslations({ locale, namespace: "certificate" });
  const { status, since } = shownStatus(cert, new Date());
  const id = formatId(cert.publicId);
  const url = verificationUrl(cert.publicId);
  const tone = { valid: "good", expired: "warn", replaced: "warn", revoked: "bad" }[status];
  const title = t(status);
  const sub = t(`${status}Sub`, { date: since ? longDate(since, ui) : "" });
  const signer = [branding.signerName, branding.signerTitle].filter(Boolean).join(" · ");
  const subject = encodeURIComponent(t("reportSubject", { id }));

  return (
    <div className="verify">
      <p className="muted">{url.replace(/^\w+:\/\//, "")}</p>
      <div
        className={`cert ${sourceSans.className}${status === "valid" ? "" : " void"}`}
        lang={locale}
        style={{ "--accent": branding.accentColour ?? DEFAULT_ACCENT } as React.CSSProperties}
      >
        <div className="sheet">
          {branding.logoKey && <img className="logo" src={`/files/${branding.logoKey}`} alt="" />}
          <div className="creator">{branding.name}</div>
          <h2 className={sourceSerif.className}>{c("title")}</h2>
          <div className="rule" />
          <div className="lead">{c("lead")}</div>
          <div
            className={`holder ${sourceSerif.className}`}
            // The PDF's size in points, as a share of the page's 842.
            style={{
              fontSize: `${(nameSize(cert.holderName, serifWidth(cert.holderName)) / 842) * 100}cqw`,
            }}
          >
            {cert.holderName}
          </div>
          <p className="statement">
            {c.rich("passed", {
              assessment: snapshot.title,
              score: cert.score,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
          <div className="bottom">
            <div>
              {c("issued", { date: longDate(cert.issuedAt, locale) })}
              <br />
              {cert.expiresAt
                ? c("validUntil", { date: longDate(cert.expiresAt, locale) })
                : c("noExpiry")}
              <br />
              {c("version", { n: version.number })}
              <br />
              {c.rich("id", { id, mono: (chunks) => <span className="mono">{chunks}</span> })}
            </div>
            <div className="qr">
              <img src={await QRCode.toDataURL(url, { margin: 0, width: 288 })} alt="" />
              <div className="mono">{url.replace(/^\w+:\/\//, "")}</div>
            </div>
            <div className="signer">
              {branding.signatureKey && <img src={`/files/${branding.signatureKey}`} alt="" />}
              <div>{signer}</div>
            </div>
          </div>
        </div>
        {status !== "valid" && (
          <div className={`stamp ${tone}`} aria-hidden>
            {title}
          </div>
        )}
      </div>
      <Status tone={tone} icon={ICONS[status]} title={title} sub={sub} />
      <div className="below">
        <dl>
          <dt>{t("holder")}</dt>
          <dd>{cert.holderName}</dd>
          <dt>{t("assessment")}</dt>
          <dd>
            {snapshot.title} <span className="muted">· {t("version", { n: version.number })}</span>
          </dd>
          <dt>{t("score")}</dt>
          <dd>
            {cert.score}%{" "}
            <span className="muted">({t("passing", { n: settings.passingScore })})</span>
          </dd>
          <dt>{t("issued")}</dt>
          <dd>{longDate(cert.issuedAt, ui)}</dd>
          <dt>{t("expires")}</dt>
          <dd>{cert.expiresAt ? longDate(cert.expiresAt, ui) : t("never")}</dd>
          <dt>{t("id")}</dt>
          <dd className="mono">{id}</dd>
        </dl>
        <div className="stack">
          <div className="row">
            {branding.logoKey && (
              <img className="issuer" src={`/files/${branding.logoKey}`} alt="" />
            )}
            <div>
              <div>{t.rich("issuedBy", { creator: branding.name, b: (x) => <b>{x}</b> })}</div>
              <div className="muted">
                {t("since", { date: longDate(cert.creatorJoinedAt, ui) })}
              </div>
            </div>
          </div>
          {status === "valid" && (
            <a className="button" href={`/c/${cert.publicId}/pdf`} download>
              {t("download")}
            </a>
          )}
          <a className="muted" href={`mailto:${process.env.OPERATOR_EMAIL}?subject=${subject}`}>
            {t("report")}
          </a>
        </div>
      </div>
    </div>
  );
}

function Status(p: { tone: string; icon: string; title: string; sub: string }) {
  return (
    <div className={`status ${p.tone}`} role="status">
      <span aria-hidden>{p.icon}</span>
      <div>
        <b>{p.title}</b> · {p.sub}
      </div>
    </div>
  );
}
