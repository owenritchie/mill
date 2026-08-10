CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New chat' NOT NULL,
	`mode` text DEFAULT 'plan' NOT NULL,
	`messages` text DEFAULT '[]' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
