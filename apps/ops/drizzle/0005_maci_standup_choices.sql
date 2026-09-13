ALTER TABLE "maci_instances" ADD COLUMN IF NOT EXISTS "circuit_profile" text DEFAULT 'small' NOT NULL;
--> statement-breakpoint
ALTER TABLE "maci_instances" ADD COLUMN IF NOT EXISTS "policy" text DEFAULT 'Free for all' NOT NULL;
--> statement-breakpoint
ALTER TABLE "maci_instances" ADD COLUMN IF NOT EXISTS "vote_balance_assigner" text DEFAULT 'Constant vote balance' NOT NULL;
