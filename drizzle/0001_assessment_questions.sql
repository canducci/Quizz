CREATE TABLE `assessment` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `creator`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`options` text NOT NULL,
	`keep_order` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessment`(`id`) ON UPDATE no action ON DELETE cascade
);
