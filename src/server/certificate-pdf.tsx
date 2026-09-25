/* eslint-disable jsx-a11y/alt-text -- react-pdf's Image is a PDF image, not an <img>; it takes no alt. */
import { join } from "node:path";
import {
  Circle,
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import * as fontkit from "fontkit";
import { createTranslator } from "next-intl";
import QRCode from "qrcode";
import type { certificate } from "../db/schema";
import {
  NAME_BOX,
  formatId,
  nameSize,
  verificationUrl,
  type CertificateVersion,
} from "../domain/certificate";
import { DEFAULT_ACCENT, type Snapshot } from "../domain/publish";
import { messagesFor } from "../i18n/locales";
import { getFile } from "./files";

const fonts = join(process.cwd(), "fonts");
const SERIF = join(fonts, "SourceSerif4-Regular.ttf");
Font.register({ family: "Serif", src: SERIF });
Font.register({
  family: "Sans",
  fonts: [
    { src: join(fonts, "SourceSans3-Regular.ttf") },
    { src: join(fonts, "SourceSans3-Bold.ttf"), fontWeight: 700 },
  ],
});
// Words aren't hyphenated, except one too long for its line: react-pdf breaks it between any two
// letters, with a hyphen. ponytail: "too long" is a guess at 24 letters; a narrower one breaks early.
Font.registerHyphenationCallback((word) => (word.length > 24 ? [...word] : [word]));

const serif = fontkit.openSync(SERIF) as fontkit.Font;
/** Text's width at 1pt in the serif, for nameSize. */
const serifWidth = (text: string) => serif.layout(text).advanceWidth / serif.unitsPerEm;

// The prototype's CSS pixels at 96 dpi, as points: A4 landscape is 1123 × 794 px, 842 × 595 pt.
const px = (n: number) => n * 0.75;
// The circle's centre sits 953 px down (120% of the page) with a 442 px radius.
const ARC_TOP = 794 - (953 - 442);
const GREY = { text: "#374151", lead: "#4b5563", meta: "#6b7280", line: "#d1d5db", ink: "#111827" };

const styles = StyleSheet.create({
  page: {
    padding: `${px(64)} ${px(100)}`,
    alignItems: "center",
    textAlign: "center",
    fontFamily: "Sans",
    color: GREY.ink,
  },
  logo: { width: px(64), height: px(64), objectFit: "contain" },
  creator: {
    marginTop: px(12),
    fontSize: px(16),
    fontWeight: 700,
    letterSpacing: px(16) * 0.06,
    textTransform: "uppercase",
    color: GREY.text,
  },
  heading: {
    fontFamily: "Serif",
    fontSize: px(44),
    lineHeight: 1.1,
    letterSpacing: px(44) * 0.02,
    marginTop: px(34),
    marginBottom: px(6),
  },
  rule: { width: px(140), height: px(2), marginTop: px(14), marginBottom: px(24) },
  lead: { fontSize: px(17), color: GREY.lead },
  holder: {
    fontFamily: "Serif",
    lineHeight: NAME_BOX.lineHeight,
    maxWidth: NAME_BOX.width + 2 * px(30),
    marginTop: px(12),
    marginBottom: px(18),
    paddingHorizontal: px(30),
    paddingBottom: px(12),
    borderBottom: `${px(1)} solid ${GREY.line}`,
  },
  statement: { fontSize: px(19), lineHeight: 1.5, maxWidth: px(760), color: GREY.text },
  bold: { fontWeight: 700 },
  bottom: { marginTop: "auto", width: "100%", flexDirection: "row", alignItems: "flex-end" },
  side: { flex: 1 },
  meta: { fontSize: px(12), lineHeight: 1.6, color: GREY.meta },
  mono: { fontFamily: "Courier" },
  // 80 px of code inside an 8 px white margin and a 1 px grey outline.
  qr: { padding: px(8), marginHorizontal: "auto", border: `${px(1)} solid ${GREY.line}` },
  signature: { height: px(40), objectFit: "contain", marginBottom: px(4) },
  signer: {
    borderTop: `${px(1)} solid ${GREY.ink}`,
    paddingTop: px(6),
    fontSize: px(14),
    color: GREY.text,
  },
});

export type CertificateFacts = Pick<
  typeof certificate.$inferSelect,
  "publicId" | "holderName" | "score" | "issuedAt" | "expiresAt"
>;
export type CertificateImages = { logo: string | null; signature: string | null };

/** A stored image as a data URL, or null if it's missing from Silo. */
async function dataUrl(key: string | null) {
  const file = key && (await getFile(key));
  if (!file) return null;
  const bytes = Buffer.from(await new Response(file.body).arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

export const brandingImages = async ({ branding }: Snapshot): Promise<CertificateImages> => ({
  logo: await dataUrl(branding.logoKey),
  signature: await dataUrl(branding.signatureKey),
});

/** The Certificate PDF (Variant C), all text in the Assessment Language. Never stored: rendered
 * from the Certificate and its Version whenever it's needed. */
export async function certificatePdf(
  cert: CertificateFacts,
  { number, snapshot }: CertificateVersion,
  images: CertificateImages,
  appUrl = process.env.APP_URL,
) {
  const locale = snapshot.settings.language;
  // Not getTranslations: this also renders outside a Next request (Vitest, and later the sweep).
  const t = createTranslator({
    locale,
    messages: await messagesFor(locale),
    namespace: "certificate",
  });
  const { branding } = snapshot;
  const accent = branding.accentColour ?? DEFAULT_ACCENT;
  const url = verificationUrl(cert.publicId, appUrl);
  const date = (d: Date) =>
    d.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const qr = await QRCode.toDataURL(url, { margin: 0, width: 288 });
  const signer = [branding.signerName, branding.signerTitle].filter(Boolean).join(" · ");

  return renderToBuffer(
    <Document title={`${t("title")} ${formatId(cert.publicId)}`} author={branding.name}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* The soft arc behind the lower half (the prototype's radial gradient, 10% accent), drawn
            as the visible top of the circle. `fixed` keeps it out of the flow: in the flow,
            react-pdf's page breaking loops forever once the text reaches the bottom row. */}
        <Svg
          fixed
          style={{ position: "absolute", left: 0, bottom: 0 }}
          width={px(1123)}
          height={px(ARC_TOP)}
          viewBox={`0 ${794 - ARC_TOP} 1123 ${ARC_TOP}`}
        >
          <Circle cx={561.5} cy={953} r={442} fill={accent} fillOpacity={0.1} />
        </Svg>
        {images.logo && <Image src={images.logo} style={styles.logo} />}
        <Text style={styles.creator}>{branding.name}</Text>
        <Text style={styles.heading}>{t("title")}</Text>
        <View style={[styles.rule, { backgroundColor: accent }]} />
        <Text style={styles.lead}>{t("lead")}</Text>
        <Text
          style={[
            styles.holder,
            { fontSize: nameSize(cert.holderName, serifWidth(cert.holderName)) },
          ]}
        >
          {cert.holderName}
        </Text>
        <Text style={styles.statement}>
          {t.rich("passed", {
            assessment: snapshot.title,
            score: cert.score,
            b: (chunks) => <Text style={styles.bold}>{chunks}</Text>,
          })}
        </Text>
        <View style={styles.bottom}>
          <View style={[styles.side, { alignItems: "flex-start", textAlign: "left" }]}>
            <Text style={styles.meta}>{t("issued", { date: date(cert.issuedAt) })}</Text>
            <Text style={styles.meta}>
              {cert.expiresAt ? t("validUntil", { date: date(cert.expiresAt) }) : t("noExpiry")}
            </Text>
            <Text style={styles.meta}>{t("version", { n: number })}</Text>
            <Text style={styles.meta}>
              {t.rich("id", {
                id: formatId(cert.publicId),
                mono: (chunks) => <Text style={styles.mono}>{chunks}</Text>,
              })}
            </Text>
          </View>
          <View style={{ marginHorizontal: px(24) }}>
            <View style={styles.qr}>
              <Image src={qr} style={{ width: px(80), height: px(80) }} />
            </View>
            <Text style={[styles.meta, styles.mono, { marginTop: px(4) }]}>
              {url.replace(/^\w+:\/\//, "")}
            </Text>
          </View>
          <View style={styles.side}>
            {images.signature && <Image src={images.signature} style={styles.signature} />}
            <Text style={styles.signer}>{signer}</Text>
          </View>
        </View>
      </Page>
    </Document>,
  );
}
