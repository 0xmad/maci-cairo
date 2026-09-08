/*
 * CLI entry: create one Poll on an already-stood-up local MACI.
 *
 * Uses sncast profile `devnet`. `--config` is a strict JSON intent file.
 * The labeled record is written to stdout.
 */
import { readFileSync } from "node:fs";

import { createPoll, formatCreatePoll, parseCreatePollArgv, parseCreatePollConfig } from "./createPoll.js";
import { sncastField } from "./sncast.js";

const configPath = parseCreatePollArgv(process.argv.slice(2));

const config = parseCreatePollConfig(readFileSync(configPath, "utf8"));
const result = createPoll({ field: sncastField }, config);

process.stdout.write(`${formatCreatePoll(result)}\n`);
