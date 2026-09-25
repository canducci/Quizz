import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { verificationUrl, type CertificateVersion } from "@/domain/certificate";
import {
  brandingImages,
  certificateFile,
  certificatePdf,
  type CertificateFacts,
} from "./certificate-pdf";
import { sendMail } from "./mail";
import { countEmail } from "./one-time-code";

/** Sends the Certificate PDF, in its Assessment Language, and counts it towards the daily cap,
 * which never refuses it. False if it couldn't be sent: the Learner is told and can send it again.
 * Not a server action: it must never be callable with any Certificate and any address. */
export async function mailCertificate(
  email: string,
  cert: CertificateFacts,
  version: CertificateVersion,
) {
  const { snapshot } = version;
  try {
    const pdf = await certificatePdf(cert, version, await brandingImages(snapshot));
    const t = await getTranslations({
      locale: snapshot.settings.language,
      namespace: "certificate",
    });
    const values = {
      name: cert.holderName,
      title: snapshot.title,
      score: cert.score,
      creator: snapshot.branding.name,
      url: verificationUrl(cert.publicId),
    };
    await sendMail(email, t("mail.subject", values), t("mail.body", values), [
      { filename: await certificateFile(cert.publicId, version), content: pdf },
    ]);
    await countEmail(db);
    return true;
  } catch (e) {
    console.error(`Certificate ${cert.publicId} not emailed`, e);
    return false;
  }
}
