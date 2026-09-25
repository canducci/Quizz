import { db } from "@/db";
import { shownStatus } from "@/domain/certificate";
import { brandingImages, certificateFile, certificatePdf } from "@/server/certificate-pdf";
import { publicCertificate } from "@/server/certificates";

/** Download PDF: only while the Certificate is valid. Rendered afresh, never stored. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await publicCertificate(db, (await params).id);
  if (!found || shownStatus(found, new Date()).status !== "valid")
    return new Response("Not found", { status: 404 });
  const { version, ...cert } = found;
  const pdf = await certificatePdf(cert, version, await brandingImages(version.snapshot));
  const file = encodeURIComponent(await certificateFile(cert.publicId, version));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${file}`,
      "Cache-Control": "no-store",
    },
  });
}
