/*
 * sncast CLI adapter: `--json --wait` on profile `devnet`, cwd this package
 * (so `snfoundry.toml` applies).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSncastField } from "./sncastJson.js";

const PACKAGE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SNCAST_GLOBALS = ["--json", "--wait", "--wait-timeout", "300", "--profile", "devnet"] as const;

function sncastArgv(args: string[]): string[] {
  const rpcUrl = process.env.STARKNET_RPC_URL;

  if (rpcUrl === undefined || rpcUrl.length === 0) {
    return [...SNCAST_GLOBALS, ...args];
  }

  if (args.length === 0) {
    return [...SNCAST_GLOBALS, "--url", rpcUrl];
  }

  const [command, ...rest] = args;

  return [...SNCAST_GLOBALS, command, "--url", rpcUrl, ...rest];
}

/**
 * Run sncast and return one field from the last JSON response or error.
 *
 * stdout and stderr are concatenated because sncast may emit JSON on either.
 *
 * @param key - JSON key (`class_hash`, `contract_address`, `response`, `transaction_hash`).
 * @param args - Subcommand tokens after the global flags.
 */
export function sncastField(key: string, args: string[]): string {
  const result = spawnSync("sncast", sncastArgv(args), {
    cwd: PACKAGE_DIR,
    encoding: "utf8",
    env: process.env,
  });

  if (result.error !== undefined) {
    throw new Error(`sncast failed to start: ${result.error.message}`);
  }

  const raw = `${result.stdout}${result.stderr}`;

  if (raw.trim().length === 0) {
    throw new Error(`sncast produced no output (exit ${String(result.status)})`);
  }

  try {
    return parseSncastField(raw, key);
  } catch (caught) {
    if (caught instanceof Error && caught.message === "sncast output had no JSON object") {
      throw new Error(`${caught.message}: ${raw.trim().slice(0, 500)}`);
    }

    throw caught;
  }
}

/**
 * Declare a `maci_contracts` Sierra class. Reuses an already-declared class hash.
 */
export function declareClass(contractName: string): string {
  return sncastField("class_hash", ["declare", "--package", "maci_contracts", "--contract-name", contractName]);
}

/**
 * Deploy through the UDC with `--unique` so repeated stand-ups get distinct addresses.
 *
 * @param argumentsExpr - Optional Cairo constructor expression after `--arguments`.
 */
export function deployUnique(classHash: string, argumentsExpr?: string): string {
  const args = ["deploy", "--class-hash", classHash, "--unique"];

  if (argumentsExpr !== undefined) {
    args.push("--arguments", argumentsExpr);
  }

  return sncastField("contract_address", args);
}
