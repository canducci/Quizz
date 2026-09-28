CREATE TABLE `certificate` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`version_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`email_hash` text NOT NULL,
	`holder_name` text NOT NULL,
	`score` integer NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer,
	`status` text DEFAULT 'valid' NOT NULL,
	`status_at` integer,
	`revocation_reason` text,
	`replaced_by_id` text,
	`expiry_counted_at` integer,
	FOREIGN KEY (`version_id`) REFERENCES `assessment_version`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `creator`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_public_id_unique` ON `certificate` (`public_id`);--> statement-breakpoint
CREATE INDEX `certificate_learner` ON `certificate` (`email_hash`);