CREATE TABLE `assessment_version` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`number` integer NOT NULL,
	`published_at` integer NOT NULL,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_version_number` ON `assessment_version` (`assessment_id`,`number`);--> statement-breakpoint
ALTER TABLE `assessment` ADD `current_version_id` text;