ALTER TABLE `users` ADD `role` text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `age` integer;