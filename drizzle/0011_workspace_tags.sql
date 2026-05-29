ALTER TABLE `tags` ADD `notebook_id` text REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
ALTER TABLE `tags` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_name_notebook_unique` ON `tags` (`user_id`,`name`,`notebook_id`);
