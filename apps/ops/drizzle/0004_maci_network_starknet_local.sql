UPDATE "maci_instances" SET "network" = 'starknet_local' WHERE "network" IN ('local', 'Starknet Local');
ALTER TABLE "maci_instances" ALTER COLUMN "network" SET DEFAULT 'starknet_local';
