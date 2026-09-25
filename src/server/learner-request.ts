import { headers } from "next/headers";

export const DAILY_CAP = Number(process.env.DAILY_EMAIL_CAP) || 300;

// ponytail: Next passes a client-sent X-Forwarded-For through untouched, so the per-IP limit
// only holds behind a proxy that overwrites it. The per-email limit and daily cap hold regardless.
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}
