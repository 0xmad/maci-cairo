CREATE TABLE IF NOT EXISTS "standup_checkpoints" (
	"id" integer PRIMARY KEY NOT NULL,
	"lean_imt" text,
	"checker" text,
	"enforcer" text,
	"assigner" text,
	"maci" text
);
