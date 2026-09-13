/*
 * CLI entry: deploy one FreeForAll MACI on `starknet-devnet --seed 0`.
 *
 * Uses sncast profile `devnet` from this package's `snfoundry.toml`.
 * Optional `COORDINATOR_OVERRIDE` replaces the seed-0 `devnet-1` coordinator.
 * The labeled address record is written to stdout.
 */
import { deployMaci, formatDeployMaci } from "./maci.js";
import { declareClass, deployUnique, sncastField } from "./sncast.js";

const result = await deployMaci(
  { declareClass, deployUnique, field: sncastField },
  { coordinatorOverride: process.env.COORDINATOR_OVERRIDE },
);

process.stdout.write(`${formatDeployMaci(result)}\n`);
