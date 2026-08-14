import { LeanIMT } from "@zk-kit/lean-imt";
import { Circomkit, type CircomkitConfig, type WitnessTester } from "circomkit";
import { poseidon2 } from "poseidon-lite/poseidon2";

import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const configFilePath = path.resolve(__dirname, "..", "circomkit.json");
const config = JSON.parse(
  fs.readFileSync(configFilePath, "utf-8"),
) as CircomkitConfig;

export const circomkitInstance = new Circomkit({
  ...config,
  verbose: false,
});

export const getSignal = async (
  tester: WitnessTester,
  witness: bigint[],
  name: string,
): Promise<bigint> => {
  const signalFullName = `main.${name}`;

  const out = await tester.readWitness(witness, [signalFullName]);
  return BigInt(out[signalFullName]);
};

export const getSignalArray = async (
  tester: WitnessTester,
  witness: bigint[],
  name: string,
  rows: number,
  columns: number,
): Promise<bigint[][]> => {
  const out = await tester.readWitness(
    witness,
    Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;

      return `main.${name}[${row}][${column}]`;
    }),
  );

  const result = Array.from({ length: rows }, () => Array(columns).fill(0n));

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      result[row][column] = BigInt(out[`main.${name}[${row}][${column}]`]);
    }
  }

  return result;
};

export interface BinaryMerkleTreeProof {
  leaf: bigint;
  depth: number;
  index: number;
  siblings: bigint[];
  root: bigint;
}

export const generateBinaryMerkleRoot = (
  maxDepth = 5,
  leafIndex = 0,
  value = 0n,
): BinaryMerkleTreeProof => {
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  for (let index = 0; index < 2 ** maxDepth; index += 1) {
    if (leafIndex === index) {
      tree.insert(value);
    } else {
      tree.insert(BigInt(index));
    }
  }

  const leaf = tree.leaves[leafIndex];
  const { siblings, index } = tree.generateProof(leafIndex);
  const depth = siblings.length;

  // For example, if the circuit expects a Merkle tree of depth 20,
  // the input must always include 20 sibling nodes, even if the actual
  // tree depth is smaller (e.g., 3). The unused sibling positions can be
  // filled with 0, as they won't affect the root calculation in the circuit.
  for (let index = 0; index < maxDepth; index += 1) {
    if (siblings[index] === undefined) {
      siblings[index] = BigInt(0);
    }
  }

  return {
    leaf,
    depth,
    index,
    siblings,
    root: tree.root,
  };
};

export const SUB_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

const generateRandomScalar = (): bigint => {
  while (true) {
    const bytes = randomBytes(32);

    const scalar = bytes.reduce((acc, byte) => (acc << 8n) + BigInt(byte), 0n);

    if (scalar < SUB_ORDER) {
      return scalar;
    }
  }
};
