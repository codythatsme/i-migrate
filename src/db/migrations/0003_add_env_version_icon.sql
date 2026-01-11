-- Add version and icon columns to environments table
ALTER TABLE `environments` ADD `version` text NOT NULL DEFAULT 'EMS';
--> statement-breakpoint
ALTER TABLE `environments` ADD `icon` text;
