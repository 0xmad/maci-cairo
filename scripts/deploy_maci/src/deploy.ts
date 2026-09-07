/*
 * CLI entry: stand up one FreeForAll MACI on `starknet-devnet --seed 0`.
 *
 * Uses sncast profile `devnet` from this package's `snfoundry.toml`.
 * Optional `COORDINATOR_OVERRIDE` replaces the seed-0 `devnet-1` coordinator.
 * The labeled address record is written to stdout.
 */
import { declareClass, deployUnique, sncastField } from "./sncast.js";
import { formatStandUp, standUp } from "./standUp.js";

const result = standUp(
  { declareClass, deployUnique, field: sncastField },
  { coordinatorOverride: process.env.COORDINATOR_OVERRIDE },
);

process.stdout.write(`${formatStandUp(result)}\n`);
