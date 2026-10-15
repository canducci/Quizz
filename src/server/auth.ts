import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { and, eq, isNotNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { ensureCreator } from "@/db/creator";
import { CAPTCHA_FAILED, CAPTCHA_HEADER } from "@/domain/captcha";
import * as schema from "@/db/schema";
import { captchaPassed } from "./captcha";
import { googleEnabled } from "./env";
import { sendMail } from "./mail";

export const auth = betterAuth({
  baseURL: process.env.APP_URL,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  advanced: { database: { generateId: () => uuidv7() } },
  socialProviders: googleEnabled()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  hooks: {
    // No magic link goes out without a solved CAPTCHA (ADR 0007).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/magic-link") return;
      if (!(await captchaPassed(ctx.headers?.get(CAPTCHA_HEADER))))
        throw new APIError("BAD_REQUEST", { message: "CAPTCHA failed", code: CAPTCHA_FAILED });
    }),
  },
  databaseHooks: {
    session: {
      create: {
        // A Creator Ban blocks sign-in; Better Auth then redirects with an error.
        before: async (session) => {
          const [banned] = await db
            .select({ id: schema.creator.id })
            .from(schema.creator)
            .where(
              and(
                eq(schema.creator.authUserId, session.userId),
                isNotNull(schema.creator.bannedAt),
              ),
            );
          return !banned;
        },
        after: (session) => ensureCreator(db, session.userId),
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const t = await getTranslations("email.magicLink");
        await sendMail(email, t("subject"), t("body", { url }));
      },
    }),
    nextCookies(),
  ],
});

/** The signed-in Creator, or null when nobody is signed in. */
export const currentCreator = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [creator] = await db
    .select()
    .from(schema.creator)
    .where(eq(schema.creator.authUserId, session.user.id));
  // A session made before a Creator Ban counts as signed out.
  return creator && !creator.bannedAt ? creator : null;
});

/** The signed-in Creator; anyone else goes to the sign-in page. */
export async function requireCreator() {
  const creator = await currentCreator();
  if (!creator) redirect("/");
  return creator;
}
