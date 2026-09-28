CREATE TABLE "assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"access_mode" text DEFAULT 'public' NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit" integer DEFAULT 10 NOT NULL,
	"drawn" integer DEFAULT 5 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"cooldown" integer DEFAULT 60 NOT NULL,
	"expiry_days" integer,
	"current_version_id" text
);
--> statement-breakpoint
CREATE TABLE "assessment_version" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"number" integer NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"version_id" text NOT NULL,
	"email_hash" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"drawn" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"outcome" text DEFAULT 'in_progress' NOT NULL,
	"score" integer,
	"passed" boolean
);
--> statement-breakpoint
CREATE TABLE "certificate" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"version_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"email_hash" text NOT NULL,
	"holder_name" text NOT NULL,
	"score" integer NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'valid' NOT NULL,
	"status_at" timestamp with time zone,
	"revocation_reason" text,
	"replaced_by_id" text,
	"expiry_counted_at" timestamp with time zone,
	CONSTRAINT "certificate_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "creator" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" text,
	"name" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"logo_key" text,
	"accent_colour" text,
	"signer_name" text,
	"signer_title" text,
	"signature_key" text,
	"banned_at" timestamp with time zone,
	CONSTRAINT "creator_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "email_day" (
	"day" text PRIMARY KEY NOT NULL,
	"sent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"assessment_id" text NOT NULL,
	"email_hash" text NOT NULL,
	CONSTRAINT "invite_assessment_id_email_hash_pk" PRIMARY KEY("assessment_id","email_hash")
);
--> statement-breakpoint
CREATE TABLE "one_time_code" (
	"id" text PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"wrong_tries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"ip" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"options" jsonb NOT NULL,
	"keep_order" boolean NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stats_day" (
	"version_id" text NOT NULL,
	"day" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"timed_out" integer DEFAULT 0 NOT NULL,
	"submitted" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"certificates_issued" integer DEFAULT 0 NOT NULL,
	"revoked" integer DEFAULT 0 NOT NULL,
	"expired" integer DEFAULT 0 NOT NULL,
	"score_histogram" jsonb,
	"time_histogram" jsonb,
	"questions" jsonb,
	CONSTRAINT "stats_day_version_id_day_pk" PRIMARY KEY("version_id","day")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_creator_id_creator_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_version" ADD CONSTRAINT "assessment_version_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_version_id_assessment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_version_id_assessment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_creator_id_creator_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator" ADD CONSTRAINT "creator_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stats_day" ADD CONSTRAINT "stats_day_version_id_assessment_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."assessment_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_version_number" ON "assessment_version" USING btree ("assessment_id","number");--> statement-breakpoint
CREATE INDEX "attempt_learner" ON "attempt" USING btree ("assessment_id","email_hash","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_running" ON "attempt" USING btree ("assessment_id","email_hash") WHERE "attempt"."outcome" = 'in_progress';--> statement-breakpoint
CREATE INDEX "certificate_learner" ON "certificate" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "one_time_code_email" ON "one_time_code" USING btree ("email_hash","created_at");--> statement-breakpoint
CREATE INDEX "one_time_code_ip" ON "one_time_code" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");