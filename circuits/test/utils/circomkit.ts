import { LeanIMT } from "@zk-kit/lean-imt";
import { Circomkit } from "circomkit";
import { poseidon2 } from "poseidon-lite/poseidon2";

import fs from "node:fs";
import path from "node:path";

import type { CircomkitConfig, WitnessTester } from "circomkit";

const configFilePath = path.resolve(__dirname, "../..", "circomkit.json");
const config = JSON.parse(fs.readFileSync(configFilePath, "utf-8")) as CircomkitConfig;

export const circomkitInstance = new Circomkit({
  ...config,
  verbose: false,
});

export const getSignal = async (tester: WitnessTester, witness: bigint[], name: string): Promise<bigint> => {
  const signalFullName = `main.${name}`;

  const out = await tester.readWitness(witness, [signalFullName]);
  return out[signalFullName];
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

  const result = Array.from({ length: rows }, () => Array<bigint>(columns).fill(0n));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      result[row][column] = out[`main.${name}[${row}][${column}]`];
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

export const generateBinaryMerkleRoot = (maxDepth = 5, leafIndex = 0, value = 0n): BinaryMerkleTreeProof => {
  const tree = new LeanIMT((a, b) => poseidon2([a, b]));

  for (let index = 0; index < 2 ** maxDepth; index += 1) {
    if (leafIndex === index) {
      tree.insert(value);
    } else {
      tree.insert(BigInt(index));
    }
  }

  const leaf = tree.leaves[leafIndex];
  const proofData = tree.generateProof(leafIndex);
  const depth = proofData.siblings.length;

  // For example, if the circuit expects a Merkle tree of depth 20,
  // the input must always include 20 sibling nodes, even if the actual
  // tree depth is smaller (e.g., 3). The unused sibling positions can be
  // filled with 0, as they won't affect the root calculation in the circuit.
  const siblings = [...proofData.siblings];

  while (siblings.length < maxDepth) {
    siblings.push(0n);
  }

  return {
    leaf,
    depth,
    index: proofData.index,
    siblings: proofData.siblings,
    root: tree.root,
  };
};
