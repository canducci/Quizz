export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES = [
  { type: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
] as const;

export type ImageType = (typeof SIGNATURES)[number]["type"];

/** PNG or JPEG judged by the file's first bytes, never its name or claimed type. */
export function imageType(bytes: Uint8Array): ImageType | null {
  return SIGNATURES.find((s) => s.magic.every((b, i) => bytes[i] === b))?.type ?? null;
}
