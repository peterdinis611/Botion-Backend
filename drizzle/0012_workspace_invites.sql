CREATE TABLE `workspace_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`email` text NOT NULL,
	`invited_user_id` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`message` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_owner_email_unique` ON `workspace_invites` (`owner_user_id`,`email`);
