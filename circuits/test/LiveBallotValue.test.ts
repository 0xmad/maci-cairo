import { beforeAll, describe, expect, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { liveBallotValue } from "../ts/liveBallotTree.js";

import { circomkitInstance, getSignal } from "./utils/index.js";

const ciphertexts = (voteOptions: number): { c1: [bigint, bigint][]; c2: [bigint, bigint][] } => ({
  c1: Array.from({ length: voteOptions }, (_, index) => [BigInt(index + 1), BigInt(index + 2)]),
  c2: Array.from({ length: voteOptions }, (_, index) => [BigInt(index + 3), BigInt(index + 4)]),
});

describe("LiveBallotValue", () => {
  let twoOptions: WitnessTester<["c1", "c2"], ["out"]>;
  let seventeenOptions: WitnessTester<["c1", "c2"], ["out"]>;

  beforeAll(async () => {
    [twoOptions, seventeenOptions] = await Promise.all([
      circomkitInstance.WitnessTester("LiveBallotValue2", {
        file: "./utils/LiveBallotValue",
        template: "LiveBallotValue",
        params: [2],
      }),
      circomkitInstance.WitnessTester("LiveBallotValue17", {
        file: "./utils/LiveBallotValue",
        template: "LiveBallotValue",
        params: [17],
      }),
    ]);
  });

  test("should match the circuit when there are two vote options", async () => {
    const { c1, c2 } = ciphertexts(2);
    const witness = await twoOptions.calculateWitness({ c1, c2 });
    await twoOptions.expectConstraintPass(witness);
    const out = await getSignal(twoOptions, witness, "out");

    expect(liveBallotValue(c1, c2)).toBe(out);
  });

  test("should match the circuit when there are more vote options than Poseidon arity 16", async () => {
    const { c1, c2 } = ciphertexts(17);
    const witness = await seventeenOptions.calculateWitness({ c1, c2 });
    await seventeenOptions.expectConstraintPass(witness);
    const out = await getSignal(seventeenOptions, witness, "out");

    expect(liveBallotValue(c1, c2)).toBe(out);
  });

  test("should change the digest when one option ciphertext changes", async () => {
    const { c1, c2 } = ciphertexts(2);
    const baseline = await twoOptions.calculateWitness({ c1, c2 });
    await twoOptions.expectConstraintPass(baseline);
    const baselineOut = await getSignal(twoOptions, baseline, "out");

    const mutatedC2: [bigint, bigint][] = [c2[0], [c2[1][0] + 1n, c2[1][1]]];
    const mutated = await twoOptions.calculateWitness({ c1, c2: mutatedC2 });
    await twoOptions.expectConstraintPass(mutated);
    const mutatedOut = await getSignal(twoOptions, mutated, "out");

    expect(mutatedOut).not.toBe(baselineOut);
  });

  test("should change the digest when vote-option order changes", async () => {
    const { c1, c2 } = ciphertexts(2);
    const baseline = await twoOptions.calculateWitness({ c1, c2 });
    await twoOptions.expectConstraintPass(baseline);
    const baselineOut = await getSignal(twoOptions, baseline, "out");

    const swapped = await twoOptions.calculateWitness({
      c1: [c1[1], c1[0]],
      c2: [c2[1], c2[0]],
    });
    await twoOptions.expectConstraintPass(swapped);
    const swappedOut = await getSignal(twoOptions, swapped, "out");

    expect(swappedOut).not.toBe(baselineOut);
  });
});
