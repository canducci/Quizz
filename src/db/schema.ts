import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const creator = sqliteTable("creator", {
  id: text("id").primaryKey(),
  // Null once the account is deleted; the row stays because Certificates point at it.
  authUserId: text("auth_user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  logoKey: text("logo_key"),
  accentColour: text("accent_colour"),
  signerName: text("signer_name"),
  signerTitle: text("signer_title"),
  signatureKey: text("signature_key"),
  bannedAt: integer("banned_at", { mode: "timestamp_ms" }),
});
