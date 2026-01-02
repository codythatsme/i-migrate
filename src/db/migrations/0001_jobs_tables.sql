-- Add concurrency settings to environments table
ALTER TABLE `environments` ADD `query_concurrency` integer NOT NULL DEFAULT 5;
--> statement-breakpoint
ALTER TABLE `environments` ADD `insert_concurrency` integer NOT NULL DEFAULT 50;
--> statement-breakpoint
-- Create jobs table for migration job tracking
CREATE TABLE `jobs` (
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
	`processed_rows` integer NOT NULL DEFAULT 0,
	`successful_rows` integer NOT NULL DEFAULT 0,
	`failed_row_count` integer NOT NULL DEFAULT 0,
	`failed_query_offsets` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
-- Create failed_rows table for storing failed inserts
CREATE TABLE `failed_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`row_index` integer NOT NULL,
	`encrypted_payload` text NOT NULL,
	`error_message` text NOT NULL,
	`retry_count` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);

