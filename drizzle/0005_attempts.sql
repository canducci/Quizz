CREATE TABLE `attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`version_id` text NOT NULL,
	`email_hash` text NOT NULL,
	`started_at` integer NOT NULL,
	`deadline` integer NOT NULL,
	`drawn` text NOT NULL,
	`answers` text NOT NULL,
	`submitted_at` integer,
	`outcome` text DEFAULT 'in_progress' NOT NULL,
	`score` integer,
	`passed` integer,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `assessment_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attempt_learner` ON `attempt` (`assessment_id`,`email_hash`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_running` ON `attempt` (`assessment_id`,`email_hash`) WHERE "attempt"."outcome" = 'in_progress';--> statement-breakpoint
CREATE TABLE `stats_day` (
	`version_id` text NOT NULL,
	`day` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`timed_out` integer DEFAULT 0 NOT NULL,
	`submitted` integer DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT 0 NOT NULL,
	`certificates_issued` integer DEFAULT 0 NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	`expired` integer DEFAULT 0 NOT NULL,
	`score_histogram` text,
	`time_histogram` text,
	`questions` text,
	PRIMARY KEY(`version_id`, `day`),
	FOREIGN KEY (`version_id`) REFERENCES `assessment_version`(`id`) ON UPDATE no action ON DELETE no action
);
