CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `links` (
	`outbound` text NOT NULL,
	`inbound` text NOT NULL,
	PRIMARY KEY(`outbound`, `inbound`),
	FOREIGN KEY (`outbound`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inbound`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`title` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#2A8C7A' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT 'ink' NOT NULL,
	`priority` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`start_date` text,
	`end_date` text,
	`issue_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);