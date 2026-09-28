import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Answers, Drawn, Histogram, QuestionTally } from "../domain/attempt";
import { user } from "./auth-schema.pg";
import type { Snapshot } from "../domain/publish";
import { QUESTION_TYPES, type QuestionOption } from "../domain/question";
import { ACCESS_MODES, DEFAULT_RULES } from "../domain/settings";
import { locales } from "../i18n/locales";

export * from "./auth-schema.pg";

export const creator = pgTable("creator", {
  id: text("id").primaryKey(),
  // Null once the account is deleted; the row stays because Certificates point at it.
  authUserId: text("auth_user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  logoKey: text("logo_key"),
  accentColour: text("accent_colour"),
  signerName: text("signer_name"),
  signerTitle: text("signer_title"),
  signatureKey: text("signature_key"),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
});

export const assessment = pgTable("assessment", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => creator.id),
  status: text("status", { enum: ["draft", "published", "closed"] })
    .notNull()
    .default("draft"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
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
export const assessmentVersion = pgTable(
  "assessment_version",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id),
    number: integer("number").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    snapshot: jsonb("snapshot").$type<Snapshot>().notNull(),
  },
  (t) => [uniqueIndex("assessment_version_number").on(t.assessmentId, t.number)],
);

export type AssessmentStatus = (typeof assessment.$inferSelect)["status"];

/** Invite-only access list. On the Assessment, not the Version, so changes apply at once. */
export const invite = pgTable(
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
export const question = pgTable("question", {
  // Stable across Versions.
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id")
    .notNull()
    .references(() => assessment.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  type: text("type", { enum: QUESTION_TYPES }).notNull(),
  text: text("text").notNull(),
  options: jsonb("options").$type<QuestionOption[]>().notNull(),
  keepOrder: boolean("keep_order").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** A one-time code emailed to prove a Learner's email. Kept once used: the rate limits count these rows. */
export const oneTimeCode = pgTable(
  "one_time_code",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: text("purpose", { enum: ["attempt", "my-certificates"] }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    wrongTries: integer("wrong_tries").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    ip: text("ip").notNull(),
  },
  (t) => [
    index("one_time_code_email").on(t.emailHash, t.createdAt),
    index("one_time_code_ip").on(t.ip, t.createdAt),
  ],
);

/** Emails sent per UTC day ("2026-09-25"), for the instance-wide daily cap. */
export const emailDay = pgTable("email_day", {
  day: text("day").primaryKey(),
  sent: integer("sent").notNull(),
});

export const ATTEMPT_OUTCOMES = ["in_progress", "submitted", "timed_out"] as const;

/** One timed sitting. The server holds the clock; the Learner's name is never stored here. */
export const attempt = pgTable(
  "attempt",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id),
    versionId: text("version_id")
      .notNull()
      .references(() => assessmentVersion.id),
    emailHash: text("email_hash").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    drawn: jsonb("drawn").$type<Drawn>().notNull(),
    answers: jsonb("answers").$type<Answers>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    outcome: text("outcome", { enum: ATTEMPT_OUTCOMES }).notNull().default("in_progress"),
    score: integer("score"),
    passed: boolean("passed"),
  },
  (t) => [
    index("attempt_learner").on(t.assessmentId, t.emailHash, t.startedAt),
    // At most one running Attempt per Learner and Assessment, even if Start is sent twice.
    uniqueIndex("attempt_running")
      .on(t.assessmentId, t.emailHash)
      .where(sql`${t.outcome} = 'in_progress'`),
  ],
);

/** Assessment Statistics as running counters per Version and UTC day. Never recomputed. */
export const statsDay = pgTable(
  "stats_day",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => assessmentVersion.id),
    day: text("day").notNull(),
    attempts: integer("attempts").notNull().default(0),
    timedOut: integer("timed_out").notNull().default(0),
    submitted: integer("submitted").notNull().default(0),
    passed: integer("passed").notNull().default(0),
    certificatesIssued: integer("certificates_issued").notNull().default(0), // name corrections excluded
    revoked: integer("revoked").notNull().default(0), // name corrections excluded
    expired: integer("expired").notNull().default(0),
    scoreHistogram: jsonb("score_histogram").$type<Histogram>(), // 1% buckets
    timeHistogram: jsonb("time_histogram").$type<Histogram>(), // 1-minute buckets
    questions: jsonb("questions").$type<QuestionTally>(),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.day] })],
);

export const CERTIFICATE_STATUSES = ["valid", "revoked", "replaced"] as const;

/** Immutable proof of a pass on one Version. Only its status changes (Revocation). Expiry is
 * computed on read from `expires_at`. */
export const certificate = pgTable(
  "certificate",
  {
    id: text("id").primaryKey(),
    // 16 Crockford base32 characters; the Verification Page URL is /c/<public_id>.
    publicId: text("public_id").notNull().unique(),
    versionId: text("version_id")
      .notNull()
      .references(() => assessmentVersion.id),
    creatorId: text("creator_id")
      .notNull()
      .references(() => creator.id),
    emailHash: text("email_hash").notNull(),
    holderName: text("holder_name").notNull(),
    score: integer("score").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = never
    status: text("status", { enum: CERTIFICATE_STATUSES }).notNull().default("valid"),
    statusAt: timestamp("status_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"), // private to the Creator
    replacedById: text("replaced_by_id"), // never shown
    expiryCountedAt: timestamp("expiry_counted_at", { withTimezone: true }),
  },
  (t) => [index("certificate_learner").on(t.emailHash)],
);
