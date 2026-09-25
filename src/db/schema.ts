import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import type { Snapshot } from "../domain/publish";
import { QUESTION_TYPES, type QuestionOption } from "../domain/question";
import { ACCESS_MODES, DEFAULT_RULES } from "../domain/settings";
import { locales } from "../i18n/locales";

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
  language: text("language", { enum: locales }).notNull().default("en"),
  accessMode: text("access_mode", { enum: ACCESS_MODES }).notNull().default("public"),
  passingScore: integer("passing_score").notNull().default(DEFAULT_RULES.passingScore),
  timeLimit: integer("time_limit").notNull().default(DEFAULT_RULES.timeLimit), // minutes
  drawn: integer("drawn").notNull().default(DEFAULT_RULES.drawn),
  maxAttempts: integer("max_attempts").notNull().default(DEFAULT_RULES.maxAttempts),
  cooldown: integer("cooldown").notNull().default(DEFAULT_RULES.cooldown), // minutes
  expiryDays: integer("expiry_days"), // null = Certificates never expire
  // ponytail: no foreign key, it would be circular; publish() is the only writer.
  currentVersionId: text("current_version_id"),
});

/** Immutable: written once on publish, never updated. Certificates stay on theirs. */
export const assessmentVersion = sqliteTable(
  "assessment_version",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id),
    number: integer("number").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<Snapshot>().notNull(),
  },
  (t) => [uniqueIndex("assessment_version_number").on(t.assessmentId, t.number)],
);

/** Invite-only access list. On the Assessment, not the Version, so changes apply at once. */
export const invite = sqliteTable(
  "invite",
  {
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    emailHash: text("email_hash").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.emailHash] })],
);

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
