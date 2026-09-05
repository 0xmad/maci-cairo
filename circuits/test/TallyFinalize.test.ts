import { buildBabyjub } from "circomlibjs";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { encryptVotes } from "../ts/votes.js";

import { circomkitInstance } from "./utils/index.js";

const VOTE_OPTIONS = 5;

describe("TallyFinalize", () => {
  let circuit: WitnessTester<["pollPrivateKey", "pollPublicKey", "accumulatorC1", "accumulatorC2", "tallyTotals"]>;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    [circuit, babyJub] = await Promise.all([
      circomkitInstance.WitnessTester("TallyFinalize", {
        file: "tally/TallyFinalize",
        template: "TallyFinalize",
        params: [VOTE_OPTIONS],
      }),
      buildBabyjub(),
    ]);
  });

  test("should open an accumulator to the tally totals", async () => {
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const votes = [1n, 0n, 2n, 0n, 3n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2 } = await encryptVotes({
      votes,
      random,
      pollId: 1n,
      userCommitment: 11n,
      publicKey: pollPublicKey,
    });

    const witness = await circuit.calculateWitness({
      pollPrivateKey,
      pollPublicKey,
      accumulatorC1: c1,
      accumulatorC2: c2,
      tallyTotals: votes,
    });

    await circuit.expectConstraintPass(witness);
  });

  test("should fail when tally totals do not match the accumulator", async () => {
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const votes = [1n, 0n, 2n, 0n, 3n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2 } = await encryptVotes({
      votes,
      random,
      pollId: 1n,
      userCommitment: 11n,
      publicKey: pollPublicKey,
    });

    await circuit.expectFail({
      pollPrivateKey,
      pollPublicKey,
      accumulatorC1: c1,
      accumulatorC2: c2,
      tallyTotals: [1n, 0n, 2n, 0n, 4n],
    });
  });

  test("should fail when the poll public key does not match the private key", async () => {
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const wrongPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, 8n);
    const wrongPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(wrongPublicKeyPoint[0]),
      babyJub.F.toObject(wrongPublicKeyPoint[1]),
    ];
    const votes = [1n, 0n, 0n, 0n, 0n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2 } = await encryptVotes({
      votes,
      random,
      pollId: 1n,
      userCommitment: 11n,
      publicKey: pollPublicKey,
    });

    await circuit.expectFail({
      pollPrivateKey,
      pollPublicKey: wrongPublicKey,
      accumulatorC1: c1,
      accumulatorC2: c2,
      tallyTotals: votes,
    });
  });
});
