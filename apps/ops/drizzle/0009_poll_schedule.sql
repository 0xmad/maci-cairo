ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "start_date" text NOT NULL DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "end_date" text NOT NULL DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "poll_public_key_x" text NOT NULL DEFAULT '0';
--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "poll_public_key_y" text NOT NULL DEFAULT '0';
