import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { circomkitInstance, generateBinaryMerkleRoot } from "./utils/index.js";

const DEPTH = 4;

describe("MerkleUpdate", () => {
  let circuit: WitnessTester<["enabled", "oldRoot", "oldLeaf", "newLeaf", "index", "siblings"], ["newRoot"]>;

  beforeAll(async () => {
    circuit = await circomkitInstance.WitnessTester("MerkleUpdate", {
      file: "./utils/MerkleUpdate",
      template: "MerkleUpdate",
      params: [DEPTH],
    });
  });

  test("should replace a leaf when enabled", async () => {
    const oldProof = generateBinaryMerkleRoot(DEPTH, 1, 11n);
    const newProof = generateBinaryMerkleRoot(DEPTH, 1, 22n);

    await circuit.expectPass(
      {
        enabled: 1,
        oldRoot: oldProof.root,
        oldLeaf: 11n,
        newLeaf: 22n,
        index: 1,
        siblings: oldProof.siblings,
      },
      { newRoot: newProof.root },
    );
  });

  test("should fail when enabled and the old root is wrong", async () => {
    const oldProof = generateBinaryMerkleRoot(DEPTH, 1, 11n);

    await circuit.expectFail({
      enabled: 1,
      oldRoot: 0n,
      oldLeaf: 11n,
      newLeaf: 22n,
      index: 1,
      siblings: oldProof.siblings,
    });
  });

  test("should skip the old-root check when disabled", async () => {
    const oldProof = generateBinaryMerkleRoot(DEPTH, 1, 11n);
    const newProof = generateBinaryMerkleRoot(DEPTH, 1, 22n);

    await circuit.expectPass(
      {
        enabled: 0,
        oldRoot: 123n,
        oldLeaf: 11n,
        newLeaf: 22n,
        index: 1,
        siblings: oldProof.siblings,
      },
      { newRoot: newProof.root },
    );
  });
});
