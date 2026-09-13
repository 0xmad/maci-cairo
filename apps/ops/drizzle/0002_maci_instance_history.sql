ALTER TABLE "maci_instances" ADD COLUMN IF NOT EXISTS "network" text DEFAULT 'local' NOT NULL;
--> statement-breakpoint
ALTER TABLE "maci_instances" ADD COLUMN IF NOT EXISTS "created_at_ms" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "maci_instances_id_seq" OWNED BY "maci_instances"."id";
--> statement-breakpoint
SELECT setval('"maci_instances_id_seq"', COALESCE((SELECT MAX(id) FROM "maci_instances"), 0), true);
--> statement-breakpoint
ALTER TABLE "maci_instances" ALTER COLUMN "id" SET DEFAULT nextval('"maci_instances_id_seq"');
