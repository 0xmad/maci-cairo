CREATE TABLE IF NOT EXISTS "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at_ms" bigint NOT NULL,
	"completed_at_ms" bigint
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "one_running_job" ON "jobs" ("status") WHERE "status" = 'running';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_steps" (
	"job_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "job_steps_job_id_seq_pk" PRIMARY KEY("job_id","seq")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maci_instances" (
	"id" integer PRIMARY KEY NOT NULL,
	"lean_imt" text NOT NULL,
	"checker" text NOT NULL,
	"enforcer" text NOT NULL,
	"assigner" text NOT NULL,
	"poll_class_hash" text NOT NULL,
	"poll_factory_class_hash" text NOT NULL,
	"maci" text NOT NULL,
	"poll_factory" text NOT NULL,
	"coordinator" text NOT NULL,
	"job_id" text NOT NULL
);
