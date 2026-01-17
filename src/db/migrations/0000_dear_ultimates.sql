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
CREATE INDEX `attempts_row_id_idx` ON `attempts` (`row_id`);--> statement-breakpoint
CREATE TABLE `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`username` text NOT NULL,
	`version` text DEFAULT 'EMS' NOT NULL,
	`icon` text,
	`query_concurrency` integer DEFAULT 5 NOT NULL,
	`insert_concurrency` integer DEFAULT 50 NOT NULL,
	`encrypted_password` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
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
	`dest_type` text DEFAULT 'bo_entity' NOT NULL,
	`mappings` text NOT NULL,
	`total_rows` integer,
	`failed_query_offsets` text,
	`identity_field_names` text,
	`error_message` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
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
CREATE INDEX `rows_job_id_idx` ON `rows` (`job_id`);--> statement-breakpoint
CREATE INDEX `rows_job_status_idx` ON `rows` (`job_id`,`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`store_passwords` integer DEFAULT false NOT NULL,
	`master_password_hash` text,
	`verbose_logging` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spans` (
	`id` text PRIMARY KEY NOT NULL,
	`trace_id` text NOT NULL,
	`parent_span_id` text,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`kind` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration_ms` integer,
	`attributes` text,
	`events` text,
	`error_cause` text
);
--> statement-breakpoint
CREATE TABLE `traces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration_ms` integer,
	`error_message` text,
	`created_at` text NOT NULL
);
