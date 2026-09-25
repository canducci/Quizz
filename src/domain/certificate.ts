import { randomBytes } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A Certificate's public id: 16 Crockford base32 characters, 80 random bits. Each byte keeps its
 * low five bits; 256 is a multiple of 32, so every symbol is equally likely. */
export const newPublicId = (random = (n: number) => randomBytes(n)) =>
  [...random(16)].map((b) => CROCKFORD[b & 31]).join("");

/** "XXXX-XXXX-XXXX-XXXX", as the id is shown. */
export const formatId = (publicId: string) => publicId.match(/.{1,4}/g)!.join("-");

export const expiryOf = (issuedAt: Date, expiryDays: number | null) =>
  expiryDays === null ? null : new Date(issuedAt.getTime() + expiryDays * 24 * 60 * 60_000);

/** Where the holder's name goes, in points: the line width less a tenth for words that don't fill
 * their line, and the height left beside the longest title and branding. */
export const NAME_BOX = { width: 630 * 0.9, height: 80 };

/** The holder's name size in points. The showcase's steps come first (42pt, ×0.8 past 26
 * characters, ×0.62 past 40); then it shrinks by 5% until the wrapped name fits NAME_BOX. `ems` is
 * the name's width at 1pt in the Certificate's serif. */
export function nameSize(name: string, ems: number, base = 42) {
  const n = name.length;
  let size = n > 40 ? base * 0.62 : n > 26 ? base * 0.8 : base;
  while (Math.ceil((ems * size) / NAME_BOX.width) * size * 1.1 > NAME_BOX.height) size *= 0.95;
  return size;
}
