import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import { QUESTION_TYPES, type QuestionOption } from "../domain/question";

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

export const assessment = sqliteTable("assessment", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creator.id),
  status: text("status", { enum: ["draft", "published", "closed"] })
    .notNull()
    .default("draft"),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** The working copy of a Question; publishing snapshots it into an Assessment Version. */
export const question = sqliteTable("question", {
  // Stable across Versions.
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessment.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  type: text("type", { enum: QUESTION_TYPES }).notNull(),
  text: text("text").notNull(),
  options: text("options", { mode: "json" }).$type<QuestionOption[]>().notNull(),
  keepOrder: integer("keep_order", { mode: "boolean" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
