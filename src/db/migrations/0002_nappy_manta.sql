-- Drop old row tables (no backwards compatibility needed)
DROP TABLE IF EXISTS `failed_rows`;
--> statement-breakpoint
DROP TABLE IF EXISTS `success_rows`;
--> statement-breakpoint
-- Remove aggregated counters from jobs table
-- SQLite doesn't support DROP COLUMN in older versions, so we recreate the table
CREATE TABLE `jobs_new` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`source_environment_id` text NOT NULL,
	`source_query_path` text,
	`source_entity_type` text,
	`dest_environment_id` text NOT NULL,
	`dest_entity_type` text NOT NULL,
	`mappings` text NOT NULL,
	`total_rows` integer,
	`failed_query_offsets` text,
	`identity_field_names` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `jobs_new` SELECT
	`id`,
	`name`,
	`status`,
	`mode`,
	`source_environment_id`,
	`source_query_path`,
	`source_entity_type`,
	`dest_environment_id`,
	`dest_entity_type`,
	`mappings`,
	`total_rows`,
	`failed_query_offsets`,
	`identity_field_names`,
	`started_at`,
	`completed_at`,
	`created_at`
FROM `jobs`;
--> statement-breakpoint
DROP TABLE `jobs`;
--> statement-breakpoint
ALTER TABLE `jobs_new` RENAME TO `jobs`;
--> statement-breakpoint
-- Create new rows table
CREATE TABLE `rows` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`row_index` integer NOT NULL,
	`encrypted_payload` text NOT NULL,
	`status` text NOT NULL,
	`identity_elements` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rows_job_id_idx` ON `rows` (`job_id`);
--> statement-breakpoint
CREATE INDEX `rows_job_status_idx` ON `rows` (`job_id`, `status`);
--> statement-breakpoint
-- Create new attempts table
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`row_id` text NOT NULL,
	`reason` text NOT NULL,
	`success` integer NOT NULL,
	`error_message` text,
	`identity_elements` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_row_id_idx` ON `attempts` (`row_id`);
