"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { creator } from "@/db/schema";
import { MAX_BRAND_TEXT } from "@/domain/publish";
import { requireCreator } from "@/server/auth";
import { deleteCreatorAccount } from "@/server/creators";
import { putImage, type UploadResult } from "@/server/files";

export type BrandingState = {
  status: "idle" | "saved" | "invalid" | Extract<UploadResult, { error: unknown }>["error"];
};

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

export async function saveBranding(_: BrandingState, form: FormData): Promise<BrandingState> {
  const me = await requireCreator();

  const name = text(form, "name");
  const accent = text(form, "accent");
  const [signerName, signerTitle] = [text(form, "signerName"), text(form, "signerTitle")];
  if (!name || !/^#[0-9a-f]{6}$/i.test(accent)) return { status: "invalid" };
  if ([name, signerName, signerTitle].some((t) => t.length > MAX_BRAND_TEXT))
    return { status: "invalid" };

  const keys: { logoKey?: string; signatureKey?: string } = {};
  for (const [field, column] of [
    ["logo", "logoKey"],
    ["signature", "signatureKey"],
  ] as const) {
    const file = form.get(field);
    // An untouched file input still sends an empty File: keep the current image.
    if (!(file instanceof File) || file.size === 0) continue;
    const upload = await putImage(file);
    if ("error" in upload) return { status: upload.error };
    keys[column] = upload.key;
  }

  await db
    .update(creator)
    .set({
      name,
      accentColour: accent.toLowerCase(),
      signerName: signerName || null,
      signerTitle: signerTitle || null,
      ...keys,
    })
    .where(eq(creator.id, me.id));
  revalidatePath("/settings");
  return { status: "saved" };
}

export async function deleteAccount() {
  const me = await requireCreator();
  await deleteCreatorAccount(db, me.authUserId!);
  redirect("/?deleted=1");
}
