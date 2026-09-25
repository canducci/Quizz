import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getTranslations } from "next-intl/server";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db";
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
    user: {
      create: {
        // First sign-in makes the person a Creator.
        after: async (user) => {
          await db.insert(schema.creator).values({
            id: uuidv7(),
            authUserId: user.id,
            name: user.name,
            joinedAt: new Date(),
          });
        },
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
