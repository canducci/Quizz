import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
import { ensureCreator } from "@/db/creator";
import * as schema from "@/db/schema";
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
  databaseHooks: {
    session: {
      create: { after: (session) => ensureCreator(db, session.userId) },
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
export async function currentCreator() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [creator] = await db
    .select()
    .from(schema.creator)
    .where(eq(schema.creator.authUserId, session.user.id));
  return creator ?? null;
}
