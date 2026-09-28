CREATE TABLE `email_day` (
	`day` text PRIMARY KEY NOT NULL,
	`sent` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `one_time_code` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`wrong_tries` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`ip` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `one_time_code_email` ON `one_time_code` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `one_time_code_ip` ON `one_time_code` (`ip`,`created_at`);