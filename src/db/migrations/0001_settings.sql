-- Add settings table for app configuration
CREATE TABLE IF NOT EXISTS `settings` (
	`id` text PRIMARY KEY NOT NULL DEFAULT 'default',
	`store_passwords` integer NOT NULL DEFAULT false,
	`master_password_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
-- Add encrypted_password column to environments table
ALTER TABLE `environments` ADD COLUMN `encrypted_password` text;
