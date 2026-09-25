"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireCreator } from "@/server/auth";
import { revokeCertificate } from "@/server/certificates";

/** Revokes one of the signed-in Creator's Certificates, then shows the same search again. */
export async function revoke(form: FormData) {
  const me = await requireCreator();
  const [q, publicId, reason] = ["q", "publicId", "reason"].map((f) => String(form.get(f) ?? ""));
  const done = await revokeCertificate(db, { creatorId: me.id, publicId, reason });
  redirect(`/certificates?${new URLSearchParams({ q, done: done ? "revoked" : "failed" })}`);
}
