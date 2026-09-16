CREATE TABLE IF NOT EXISTS "create_poll_jobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"maci" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"poll_public_key_x" text NOT NULL,
	"poll_public_key_y" text NOT NULL,
	"poll_id" text
);
