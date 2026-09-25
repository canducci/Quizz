import { randomBytes } from "node:crypto";
import type { Snapshot } from "./publish";

/** The Assessment Version a Certificate was earned on: what its PDF renders from. */
export type CertificateVersion = { number: number; snapshot: Snapshot };

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A Certificate's public id: 16 Crockford base32 characters, 80 random bits. Each byte keeps its
 * low five bits; 256 is a multiple of 32, so every symbol is equally likely. */
export const newPublicId = (random = (n: number) => randomBytes(n)) =>
  [...random(16)].map((b) => CROCKFORD[b & 31]).join("");

/** "XXXX-XXXX-XXXX-XXXX", as the id is shown. */
export const formatId = (publicId: string) => publicId.match(/.{1,4}/g)!.join("-");

/** The public id from a typed or linked one: dashes and case don't matter. Null if it can't be one. */
export function parsePublicId(typed: string) {
  const id = typed.replaceAll("-", "").toUpperCase();
  return id.length === 16 && [...id].every((c) => CROCKFORD.includes(c)) ? id : null;
}

export type ShownStatus = "valid" | "expired" | "revoked" | "replaced";

/** What the Verification Page says, and since when. A Revocation or replacement outranks Expiry,
 * which is computed on read: a Certificate is expired from the moment of its `expiresAt`. */
export function shownStatus(
  cert: { status: "valid" | "revoked" | "replaced"; statusAt: Date | null; expiresAt: Date | null },
  now: Date,
): { status: ShownStatus; since: Date | null } {
  if (cert.status !== "valid") return { status: cert.status, since: cert.statusAt };
  if (cert.expiresAt && cert.expiresAt <= now) return { status: "expired", since: cert.expiresAt };
  return { status: "valid", since: null };
}

/** A date as the Certificate shows it: "14 March 2026", in UTC so every server agrees. */
export const longDate = (d: Date, locale: string) =>
  d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const expiryOf = (issuedAt: Date, expiryDays: number | null) =>
  expiryDays === null ? null : new Date(issuedAt.getTime() + expiryDays * 24 * 60 * 60_000);

/** The Verification Page, which the PDF's QR code and the email link to. */
export const verificationUrl = (publicId: string, appUrl = process.env.APP_URL) =>
  `${appUrl}/c/${publicId}`;

/** The holder's name on the PDF, in points: the line width inside its hairline's padding, its line
 * height, and the height left beside the longest title and branding. The PDF lays the name out
 * from these too. */
export const NAME_BOX = { width: 630, lineHeight: 1.1, height: 80 };

/** The holder's name size in points. The showcase's steps come first (42pt, ×0.8 past 26
 * characters, ×0.62 past 40); then it shrinks by 5% until the wrapped name fits NAME_BOX, counting
 * a tenth of each line lost to words that don't fill it. `width` is the name's width at 1pt in the
 * Certificate's serif. */
export function nameSize(name: string, width: number) {
  const n = name.length;
  let size = n > 40 ? 42 * 0.62 : n > 26 ? 42 * 0.8 : 42;
  const lines = (size: number) => Math.ceil((width * size) / (NAME_BOX.width * 0.9));
  while (lines(size) * size * NAME_BOX.lineHeight > NAME_BOX.height) size *= 0.95;
  return size;
}
