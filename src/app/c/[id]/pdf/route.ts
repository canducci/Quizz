import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { formatId, parsePublicId, shownStatus } from "@/domain/certificate";
import { brandingImages, certificatePdf } from "@/server/certificate-pdf";
import { verifiedCertificate } from "@/server/certificates";

/** Download PDF: only while the Certificate is valid. Rendered afresh, never stored. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const publicId = parsePublicId((await params).id);
  const found = publicId && (await verifiedCertificate(db, publicId));
  if (!found || shownStatus(found, new Date()).status !== "valid")
    return new Response("Not found", { status: 404 });
  const { version, ...cert } = found;
  const pdf = await certificatePdf(cert, version, await brandingImages(version.snapshot));
  const t = await getTranslations({
    locale: version.snapshot.settings.language,
    namespace: "certificate",
  });
  const file = encodeURIComponent(t("file", { id: formatId(cert.publicId) }));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${file}`,
      "Cache-Control": "no-store",
    },
  });
}
