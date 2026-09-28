CREATE TABLE `invite` (
	`assessment_id` text NOT NULL,
	`email_hash` text NOT NULL,
	PRIMARY KEY(`assessment_id`, `email_hash`),
	FOREIGN KEY (`assessment_id`) REFERENCES `assessment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `assessment` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `access_mode` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `passing_score` integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `time_limit` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `drawn` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `max_attempts` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `cooldown` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment` ADD `expiry_days` integer;