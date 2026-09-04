import { buildBabyjub } from "circomlibjs";
import fc from "fast-check";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { poseidon3 } from "poseidon-lite/poseidon3";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { encryptVotes } from "../ts/votes.js";

import { circomkitInstance, generateBinaryMerkleRoot } from "./utils/index.js";

const VOTE_OPTIONS = 5;
const STATE_TREE_DEPTH = 5;

describe("Ballot", () => {
  let ballotCircuit: WitnessTester<
    [
      "ballotHash",
      "votes",
      "random",
      "userPrivateKey",
      "userPublicKey",
      "userVotesBalance",
      "userTreeIndex",
      "userTreePathElements",
      "userTreeRoot",
      "pollId",
      "userCommitment",
      "pollPublicKey",
      "encryptedVotesC1",
      "encryptedVotesC2",
    ]
  >;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    ballotCircuit = await circomkitInstance.WitnessTester("Ballot", {
      file: "ballot/Ballot",
      template: "Ballot",
      params: [STATE_TREE_DEPTH, VOTE_OPTIONS],
    });

    babyJub = await buildBabyjub();
  });

  test("should validate ballot votes correctly", async () => {
    const userPrivateKey = 0n;
    const userPublicKey = [0n, 1n];
    const pollId = 0n;
    const pollPublicKey: [bigint, bigint] = [0n, 1n];
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const userVotesBalance = 3n;
    const { index, siblings, root } = generateBinaryMerkleRoot(
      STATE_TREE_DEPTH,
      0,
      poseidon3([...userPublicKey, userVotesBalance]),
    );
    const votes = [0n, 1n, 0n, 1n, 1n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2, ballotHash } = await encryptVotes({
      votes,
      random,
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });

    const ballotWitness = await ballotCircuit.calculateWitness({
      votes,
      random,
      userVotesBalance,
      userPrivateKey,
      userPublicKey,
      pollPublicKey,
      userTreeIndex: index,
      userTreePathElements: siblings,
      userTreeRoot: root,
      pollId,
      userCommitment,
      encryptedVotesC1: c1,
      encryptedVotesC2: c2,
      ballotHash,
    });

    await ballotCircuit.expectConstraintPass(ballotWitness);
  });

  test("should check ballot validation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }), {
          minLength: VOTE_OPTIONS,
          maxLength: VOTE_OPTIONS,
        }),
        fc.array(fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }), {
          minLength: VOTE_OPTIONS,
          maxLength: VOTE_OPTIONS,
        }),
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        async (votes: bigint[], random: bigint[], userPrivateKey: bigint, pollPrivateKey: bigint, pollId: bigint) => {
          const userPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, userPrivateKey);
          const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
          const userPublicKey = [babyJub.F.toObject(userPublicKeyPoint[0]), babyJub.F.toObject(userPublicKeyPoint[1])];
          const pollPublicKey: [bigint, bigint] = [
            babyJub.F.toObject(pollPublicKeyPoint[0]),
            babyJub.F.toObject(pollPublicKeyPoint[1]),
          ];
          const userVotesBalance = votes.reduce((acc, x) => acc + x, 0n);
          const userCommitment = poseidon2([userPrivateKey, pollId]);
          const { index, siblings, root } = generateBinaryMerkleRoot(
            STATE_TREE_DEPTH,
            0,
            poseidon3([...userPublicKey, userVotesBalance]),
          );

          const { c1, c2, ballotHash } = await encryptVotes({
            votes,
            random,
            publicKey: pollPublicKey,
            pollId,
            userCommitment,
          });

          const ballotWitness = await ballotCircuit.calculateWitness({
            votes,
            random,
            userVotesBalance,
            userPrivateKey,
            userPublicKey,
            pollPublicKey,
            userTreeIndex: index,
            userTreePathElements: siblings,
            userTreeRoot: root,
            pollId,
            userCommitment,
            encryptedVotesC1: c1,
            encryptedVotesC2: c2,
            ballotHash,
          });

          return ballotCircuit
            .expectConstraintPass(ballotWitness)
            .then(() => true)
            .catch(() => false);
        },
      ),
    );
  });

  test("should fail when votes exceed max votes", async () => {
    const userPrivateKey = 0n;
    const userPublicKey = [0n, 1n];
    const pollId = 0n;
    const pollPublicKey: [bigint, bigint] = [0n, 1n];
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const userVotesBalance = 1n;
    const { index, siblings, root } = generateBinaryMerkleRoot(
      STATE_TREE_DEPTH,
      0,
      poseidon3([...userPublicKey, userVotesBalance]),
    );
    const votes = [0n, 1n, 0n, 1n, 1n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2, ballotHash } = await encryptVotes({
      votes,
      random,
      publicKey: pollPublicKey,
      pollId,
      userCommitment,
    });

    await ballotCircuit.expectFail({
      votes,
      random,
      userVotesBalance,
      userPrivateKey,
      userPublicKey,
      pollPublicKey,
      userTreeIndex: index,
      userTreePathElements: siblings,
      userTreeRoot: root,
      pollId,
      userCommitment,
      encryptedVotesC1: c1,
      encryptedVotesC2: c2,
      ballotHash,
    });
  });

  test("should fail if votes are casted on behalf of others", async () => {
    const userPrivateKey = 0n;
    const userPublicKey = [0n, 1n];
    const pollId = 0n;
    const pollPublicKey: [bigint, bigint] = [0n, 1n];
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const userVotesBalance = 3n;
    const { index, root } = generateBinaryMerkleRoot(
      STATE_TREE_DEPTH,
      0,
      poseidon3([...userPublicKey, userVotesBalance]),
    );
    const votes = [0n, 1n, 0n, 1n, 1n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2, ballotHash } = await encryptVotes({
      votes,
      random,
      publicKey: pollPublicKey,
      pollId,
      userCommitment,
    });

    await ballotCircuit.expectFail({
      votes,
      random,
      userVotesBalance,
      userPrivateKey,
      userPublicKey,
      pollPublicKey,
      userTreeIndex: index,
      userTreePathElements: [0n, 0n, 0n, 0n, 0n],
      userTreeRoot: root,
      pollId,
      userCommitment,
      encryptedVotesC1: c1,
      encryptedVotesC2: c2,
      ballotHash,
    });
  });

  test("should fail if public key is not derived from private key", async () => {
    const userPrivateKey = 0n;
    const userPublicKey = [1n, 2n];
    const pollId = 0n;
    const pollPublicKey: [bigint, bigint] = [0n, 1n];
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const userVotesBalance = 3n;
    const { index, siblings, root } = generateBinaryMerkleRoot(
      STATE_TREE_DEPTH,
      0,
      poseidon3([...userPublicKey, userVotesBalance]),
    );
    const votes = [0n, 1n, 0n, 1n, 1n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, ballotHash } = await encryptVotes({
      votes,
      random,
      publicKey: pollPublicKey,
      pollId,
      userCommitment,
    });

    await ballotCircuit.expectFail({
      votes,
      random,
      userVotesBalance,
      userPrivateKey,
      userPublicKey,
      pollPublicKey,
      userTreeIndex: index,
      userTreePathElements: siblings,
      userTreeRoot: root,
      pollId,
      userCommitment,
      encryptedVotesC1: c1,
      encryptedVotesC2: c1,
      ballotHash,
    });
  });

  test("should fail if votes are not the same as encrypted votes", async () => {
    const userPrivateKey = 0n;
    const userPublicKey = [0n, 1n];
    const pollId = 0n;
    const pollPublicKey = [0n, 1n];
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const userVotesBalance = 3n;
    const { index, siblings, root } = generateBinaryMerkleRoot(
      STATE_TREE_DEPTH,
      0,
      poseidon3([...userPublicKey, userVotesBalance]),
    );
    const votes = [0n, 1n, 0n, 1n, 1n];
    const random = [9n, 12n, 56n, 3n, 2n];

    await ballotCircuit.expectFail({
      votes,
      random,
      userVotesBalance,
      userPrivateKey,
      userPublicKey,
      pollPublicKey,
      userTreeIndex: index,
      userTreePathElements: siblings,
      userTreeRoot: root,
      pollId,
      userCommitment,
      encryptedVotesC1: [0, 0, 0, 0, 0],
      encryptedVotesC2: [0, 0, 0, 0, 0],
      ballotHash: 0n,
    });
  });

  test("should fail if ballot hash is invalid", async () => {
    const userPrivateKey = 0n;
    const userPublicKey = [0n, 1n];
    const pollId = 0n;
    const pollPublicKey: [bigint, bigint] = [0n, 1n];
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const userVotesBalance = 3n;
    const { index, siblings, root } = generateBinaryMerkleRoot(
      STATE_TREE_DEPTH,
      0,
      poseidon3([...userPublicKey, userVotesBalance]),
    );
    const votes = [0n, 1n, 0n, 1n, 1n];
    const random = [9n, 12n, 56n, 3n, 2n];

    const { c1, c2 } = await encryptVotes({
      votes,
      random,
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });

    await ballotCircuit.expectFail({
      votes,
      random,
      userVotesBalance,
      userPrivateKey,
      userPublicKey,
      pollPublicKey,
      userTreeIndex: index,
      userTreePathElements: siblings,
      userTreeRoot: root,
      pollId,
      userCommitment,
      encryptedVotesC1: c1,
      encryptedVotesC2: c2,
      ballotHash: 1n,
    });
  });
});
