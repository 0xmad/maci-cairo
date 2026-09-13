import { afterEach, describe, expect, test, vi } from "vitest";

import { spawnSync } from "node:child_process";
import path from "node:path";

import { declareClass, deployUnique, sncastField } from "../sncast.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const spawnSyncMock = vi.mocked(spawnSync);

function sncastOk(stdout: string, stderr = ""): void {
  spawnSyncMock.mockReturnValue({
    pid: 1,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    status: 0,
    signal: null,
    error: undefined,
  });
}

describe("sncast CLI adapter", () => {
  afterEach(() => {
    spawnSyncMock.mockReset();
    Reflect.deleteProperty(process.env, "STARKNET_RPC_URL");
  });

  test("sncastField runs sncast --json --wait on the deploy package profile", () => {
    sncastOk('{"class_hash":"0xabc","command":"declare","type":"response"}');

    expect(sncastField("class_hash", ["declare", "--contract-name", "LeanIMT"])).toBe("0xabc");

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnSyncMock.mock.calls[0] ?? [];
    expect(command).toBe("sncast");
    expect(args).toEqual([
      "--json",
      "--wait",
      "--wait-timeout",
      "300",
      "--profile",
      "devnet",
      "declare",
      "--contract-name",
      "LeanIMT",
    ]);
    expect(options).toMatchObject({
      encoding: "utf8",
      cwd: path.resolve(import.meta.dirname, "../.."),
    });
  });

  test("throws when sncast is not on PATH", () => {
    spawnSyncMock.mockReturnValue({
      pid: 0,
      output: [null, "", ""],
      stdout: "",
      stderr: "",
      status: null,
      signal: null,
      error: Object.assign(new Error("spawnSync sncast ENOENT"), { code: "ENOENT" }),
    });

    expect(() => {
      sncastField("class_hash", ["declare"]);
    }).toThrow(/sncast failed to start: spawnSync sncast ENOENT/u);
  });

  test("throws when sncast prints nothing", () => {
    spawnSyncMock.mockReturnValue({
      pid: 1,
      output: [null, "", ""],
      stdout: "",
      stderr: "",
      status: 127,
      signal: null,
      error: undefined,
    });

    expect(() => {
      sncastField("class_hash", ["declare"]);
    }).toThrow(/sncast produced no output \(exit 127\)/u);
  });

  test("includes CLI text when sncast prints no JSON", () => {
    sncastOk("error: unexpected argument '--url' found\n");

    expect(() => {
      sncastField("class_hash", ["declare"]);
    }).toThrow(/unexpected argument '--url' found/u);
  });

  test("rethrows a JSON parse error that is not missing JSON", () => {
    sncastOk('{"command":"declare","type":"response"}');

    expect(() => {
      sncastField("class_hash", ["declare"]);
    }).toThrow(/missing JSON field class_hash/u);
  });

  test("passes STARKNET_RPC_URL as sncast --url", () => {
    process.env.STARKNET_RPC_URL = "http://devnet:5050/";
    sncastOk('{"class_hash":"0xabc","command":"declare","type":"response"}');

    expect(sncastField("class_hash", ["declare"])).toBe("0xabc");

    expect(spawnSyncMock.mock.calls[0]?.[1]).toEqual([
      "--json",
      "--wait",
      "--wait-timeout",
      "300",
      "--profile",
      "devnet",
      "declare",
      "--url",
      "http://devnet:5050/",
    ]);
  });

  test("passes STARKNET_RPC_URL as --url when the subcommand is omitted", () => {
    process.env.STARKNET_RPC_URL = "http://devnet:5050/";
    sncastOk('{"class_hash":"0xabc","command":"declare","type":"response"}');

    expect(sncastField("class_hash", [])).toBe("0xabc");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toEqual([
      "--json",
      "--wait",
      "--wait-timeout",
      "300",
      "--profile",
      "devnet",
      "--url",
      "http://devnet:5050/",
    ]);
  });

  test("parses JSON from stderr when stdout is empty", () => {
    sncastOk("", '{"contract_address":"0xdef","command":"deploy","type":"response"}');

    expect(sncastField("contract_address", ["deploy"])).toBe("0xdef");
  });

  test("declareClass requests maci_contracts by contract name", () => {
    sncastOk('{"class_hash":"0x11","command":"declare","type":"response"}');

    expect(declareClass("MACI")).toBe("0x11");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toEqual([
      "--json",
      "--wait",
      "--wait-timeout",
      "300",
      "--profile",
      "devnet",
      "declare",
      "--package",
      "maci_contracts",
      "--contract-name",
      "MACI",
    ]);
  });

  test("deployUnique omits --arguments when calldata is absent", () => {
    sncastOk('{"contract_address":"0x22","command":"deploy","type":"response"}');

    expect(deployUnique("0xclass")).toBe("0x22");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toEqual([
      "--json",
      "--wait",
      "--wait-timeout",
      "300",
      "--profile",
      "devnet",
      "deploy",
      "--class-hash",
      "0xclass",
      "--unique",
    ]);
  });

  test("deployUnique passes constructor calldata as --arguments", () => {
    sncastOk('{"contract_address":"0x33","command":"deploy","type":"response"}');

    expect(deployUnique("0xclass", "1, 2")).toBe("0x33");
    expect(spawnSyncMock.mock.calls[0]?.[1]).toEqual([
      "--json",
      "--wait",
      "--wait-timeout",
      "300",
      "--profile",
      "devnet",
      "deploy",
      "--class-hash",
      "0xclass",
      "--unique",
      "--arguments",
      "1, 2",
    ]);
  });
});
