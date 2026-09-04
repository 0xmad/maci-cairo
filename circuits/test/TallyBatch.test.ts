import { buildBabyjub } from "circomlibjs";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { LiveBallotTree, identityCiphertexts, liveBallotValue } from "../ts/liveBallotTree.js";
import { encryptVotes } from "../ts/votes.js";

import { BATCH_SIZE, LIVE_TREE_DEPTH, VOTE_OPTIONS, circomkitInstance, dummySlot, zeroPath } from "./utils/index.js";

describe("TallyBatch", () => {
  let circuit: WitnessTester<
    [
      "pollId",
      "realBallotCount",
      "currentChainHash",
      "newChainHash",
      "currentLiveRoot",
      "newLiveRoot",
      "currentAccumulatorC1",
      "currentAccumulatorC2",
      "newAccumulatorC1",
      "newAccumulatorC2",
      "isNew",
      "userCommitment",
      "encryptedVotesC1",
      "encryptedVotesC2",
      "oldEncryptedVotesC1",
      "oldEncryptedVotesC2",
      "leafIndex",
      "leafNextKey",
      "leafPath",
      "slotPath",
      "predecessorIndex",
      "predecessorKey",
      "predecessorNextKey",
      "predecessorValue",
      "predecessorPath",
    ]
  >;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    circuit = await circomkitInstance.WitnessTester("TallyBatch", {
      file: "tally/TallyBatch",
      template: "TallyBatch",
      params: [BATCH_SIZE, VOTE_OPTIONS, LIVE_TREE_DEPTH],
    });

    babyJub = await buildBabyjub();
  });

  test("should leave state unchanged when realBallotCount is 0", async () => {
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const accumulator = identityCiphertexts(VOTE_OPTIONS);
    const dummy = dummySlot();

    const witness = await circuit.calculateWitness({
      pollId: 1n,
      realBallotCount: 0n,
      currentChainHash: 0n,
      newChainHash: 0n,
      currentLiveRoot: tree.root,
      newLiveRoot: tree.root,
      currentAccumulatorC1: accumulator.c1,
      currentAccumulatorC2: accumulator.c2,
      newAccumulatorC1: accumulator.c1,
      newAccumulatorC2: accumulator.c2,
      isNew: Array.from({ length: BATCH_SIZE }, () => dummy.isNew),
      userCommitment: Array.from({ length: BATCH_SIZE }, () => dummy.userCommitment),
      encryptedVotesC1: Array.from({ length: BATCH_SIZE }, () => dummy.encryptedVotesC1),
      encryptedVotesC2: Array.from({ length: BATCH_SIZE }, () => dummy.encryptedVotesC2),
      oldEncryptedVotesC1: Array.from({ length: BATCH_SIZE }, () => dummy.oldEncryptedVotesC1),
      oldEncryptedVotesC2: Array.from({ length: BATCH_SIZE }, () => dummy.oldEncryptedVotesC2),
      leafIndex: Array.from({ length: BATCH_SIZE }, () => dummy.leafIndex),
      leafNextKey: Array.from({ length: BATCH_SIZE }, () => dummy.leafNextKey),
      leafPath: Array.from({ length: BATCH_SIZE }, () => dummy.leafPath),
      slotPath: Array.from({ length: BATCH_SIZE }, () => dummy.slotPath),
      predecessorIndex: Array.from({ length: BATCH_SIZE }, () => dummy.predecessorIndex),
      predecessorKey: Array.from({ length: BATCH_SIZE }, () => dummy.predecessorKey),
      predecessorNextKey: Array.from({ length: BATCH_SIZE }, () => dummy.predecessorNextKey),
      predecessorValue: Array.from({ length: BATCH_SIZE }, () => dummy.predecessorValue),
      predecessorPath: Array.from({ length: BATCH_SIZE }, () => dummy.predecessorPath),
    });

    await circuit.expectConstraintPass(witness);
  });

  test("should insert the first Ballot and absorb it into the chain hash", async () => {
    const pollId = 1n;
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const userCommitment = poseidon2([3n, pollId]);
    const votes = [1n, 0n, 0n, 0n, 0n];
    const random = [9n, 12n, 56n, 3n, 2n];
    const encrypted = await encryptVotes({
      votes,
      random,
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const value = liveBallotValue(encrypted.c1, encrypted.c2);
    const inserted = tree.insert(userCommitment, value);
    const dummy = dummySlot();
    const identity = identityCiphertexts(VOTE_OPTIONS);

    const witness = await circuit.calculateWitness({
      pollId,
      realBallotCount: 1n,
      currentChainHash: 0n,
      newChainHash: poseidon2([0n, encrypted.ballotHash]),
      currentLiveRoot,
      newLiveRoot: tree.root,
      currentAccumulatorC1: identity.c1,
      currentAccumulatorC2: identity.c2,
      newAccumulatorC1: encrypted.c1,
      newAccumulatorC2: encrypted.c2,
      isNew: [1n, dummy.isNew, dummy.isNew, dummy.isNew],
      userCommitment: [userCommitment, dummy.userCommitment, dummy.userCommitment, dummy.userCommitment],
      encryptedVotesC1: [encrypted.c1, dummy.encryptedVotesC1, dummy.encryptedVotesC1, dummy.encryptedVotesC1],
      encryptedVotesC2: [encrypted.c2, dummy.encryptedVotesC2, dummy.encryptedVotesC2, dummy.encryptedVotesC2],
      oldEncryptedVotesC1: [
        identity.c1,
        dummy.oldEncryptedVotesC1,
        dummy.oldEncryptedVotesC1,
        dummy.oldEncryptedVotesC1,
      ],
      oldEncryptedVotesC2: [
        identity.c2,
        dummy.oldEncryptedVotesC2,
        dummy.oldEncryptedVotesC2,
        dummy.oldEncryptedVotesC2,
      ],
      leafIndex: [BigInt(inserted.leafIndex), dummy.leafIndex, dummy.leafIndex, dummy.leafIndex],
      leafNextKey: [inserted.leafNextKey, dummy.leafNextKey, dummy.leafNextKey, dummy.leafNextKey],
      leafPath: [zeroPath(), dummy.leafPath, dummy.leafPath, dummy.leafPath],
      slotPath: [inserted.slotPath, dummy.slotPath, dummy.slotPath, dummy.slotPath],
      predecessorIndex: [
        BigInt(inserted.predecessorIndex),
        dummy.predecessorIndex,
        dummy.predecessorIndex,
        dummy.predecessorIndex,
      ],
      predecessorKey: [inserted.predecessorKey, dummy.predecessorKey, dummy.predecessorKey, dummy.predecessorKey],
      predecessorNextKey: [
        inserted.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
      ],
      predecessorValue: [
        inserted.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
      ],
      predecessorPath: [inserted.predecessorPath, dummy.predecessorPath, dummy.predecessorPath, dummy.predecessorPath],
    });

    await circuit.expectConstraintPass(witness);
  });

  test("should supersede an earlier Ballot for the same user commitment", async () => {
    const pollId = 1n;
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const userCommitment = poseidon2([3n, pollId]);
    const firstVotes = [1n, 0n, 0n, 0n, 0n];
    const secondVotes = [0n, 2n, 0n, 0n, 0n];
    const first = await encryptVotes({
      votes: firstVotes,
      random: [9n, 12n, 56n, 3n, 2n],
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });
    const second = await encryptVotes({
      votes: secondVotes,
      random: [4n, 8n, 15n, 16n, 23n],
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const firstInsert = tree.insert(userCommitment, liveBallotValue(first.c1, first.c2));
    const secondUpdate = tree.update(userCommitment, liveBallotValue(second.c1, second.c2));
    const dummy = dummySlot();
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const chainAfterFirst = poseidon2([0n, first.ballotHash]);

    const witness = await circuit.calculateWitness({
      pollId,
      realBallotCount: 2n,
      currentChainHash: 0n,
      newChainHash: poseidon2([chainAfterFirst, second.ballotHash]),
      currentLiveRoot,
      newLiveRoot: tree.root,
      currentAccumulatorC1: identity.c1,
      currentAccumulatorC2: identity.c2,
      newAccumulatorC1: second.c1,
      newAccumulatorC2: second.c2,
      isNew: [1n, 0n, dummy.isNew, dummy.isNew],
      userCommitment: [userCommitment, userCommitment, dummy.userCommitment, dummy.userCommitment],
      encryptedVotesC1: [first.c1, second.c1, dummy.encryptedVotesC1, dummy.encryptedVotesC1],
      encryptedVotesC2: [first.c2, second.c2, dummy.encryptedVotesC2, dummy.encryptedVotesC2],
      oldEncryptedVotesC1: [identity.c1, first.c1, dummy.oldEncryptedVotesC1, dummy.oldEncryptedVotesC1],
      oldEncryptedVotesC2: [identity.c2, first.c2, dummy.oldEncryptedVotesC2, dummy.oldEncryptedVotesC2],
      leafIndex: [BigInt(firstInsert.leafIndex), BigInt(secondUpdate.leafIndex), dummy.leafIndex, dummy.leafIndex],
      leafNextKey: [firstInsert.leafNextKey, secondUpdate.leafNextKey, dummy.leafNextKey, dummy.leafNextKey],
      leafPath: [zeroPath(), secondUpdate.leafPath, dummy.leafPath, dummy.leafPath],
      slotPath: [firstInsert.slotPath, dummy.slotPath, dummy.slotPath, dummy.slotPath],
      predecessorIndex: [
        BigInt(firstInsert.predecessorIndex),
        dummy.predecessorIndex,
        dummy.predecessorIndex,
        dummy.predecessorIndex,
      ],
      predecessorKey: [firstInsert.predecessorKey, dummy.predecessorKey, dummy.predecessorKey, dummy.predecessorKey],
      predecessorNextKey: [
        firstInsert.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
      ],
      predecessorValue: [
        firstInsert.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
      ],
      predecessorPath: [
        firstInsert.predecessorPath,
        dummy.predecessorPath,
        dummy.predecessorPath,
        dummy.predecessorPath,
      ],
    });

    await circuit.expectConstraintPass(witness);
  });

  test("should add live ciphertexts from two user commitments", async () => {
    const pollId = 1n;
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const firstCommitment = poseidon2([3n, pollId]);
    const secondCommitment = poseidon2([5n, pollId]);
    const first = await encryptVotes({
      votes: [1n, 0n, 0n, 0n, 0n],
      random: [9n, 12n, 56n, 3n, 2n],
      pollId,
      userCommitment: firstCommitment,
      publicKey: pollPublicKey,
    });
    const second = await encryptVotes({
      votes: [0n, 2n, 0n, 0n, 0n],
      random: [4n, 8n, 15n, 16n, 23n],
      pollId,
      userCommitment: secondCommitment,
      publicKey: pollPublicKey,
    });
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const firstInsert = tree.insert(firstCommitment, liveBallotValue(first.c1, first.c2));
    const secondInsert = tree.insert(secondCommitment, liveBallotValue(second.c1, second.c2));
    const dummy = dummySlot();
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const chainAfterFirst = poseidon2([0n, first.ballotHash]);
    const summedC1 = first.c1.map((point, index) => {
      const sum = babyJub.addPoint(
        [babyJub.F.e(point[0]), babyJub.F.e(point[1])],
        [babyJub.F.e(second.c1[index][0]), babyJub.F.e(second.c1[index][1])],
      );

      return [babyJub.F.toObject(sum[0]), babyJub.F.toObject(sum[1])] as [bigint, bigint];
    });
    const summedC2 = first.c2.map((point, index) => {
      const sum = babyJub.addPoint(
        [babyJub.F.e(point[0]), babyJub.F.e(point[1])],
        [babyJub.F.e(second.c2[index][0]), babyJub.F.e(second.c2[index][1])],
      );

      return [babyJub.F.toObject(sum[0]), babyJub.F.toObject(sum[1])] as [bigint, bigint];
    });

    const witness = await circuit.calculateWitness({
      pollId,
      realBallotCount: 2n,
      currentChainHash: 0n,
      newChainHash: poseidon2([chainAfterFirst, second.ballotHash]),
      currentLiveRoot,
      newLiveRoot: tree.root,
      currentAccumulatorC1: identity.c1,
      currentAccumulatorC2: identity.c2,
      newAccumulatorC1: summedC1,
      newAccumulatorC2: summedC2,
      isNew: [1n, 1n, dummy.isNew, dummy.isNew],
      userCommitment: [firstCommitment, secondCommitment, dummy.userCommitment, dummy.userCommitment],
      encryptedVotesC1: [first.c1, second.c1, dummy.encryptedVotesC1, dummy.encryptedVotesC1],
      encryptedVotesC2: [first.c2, second.c2, dummy.encryptedVotesC2, dummy.encryptedVotesC2],
      oldEncryptedVotesC1: [identity.c1, identity.c1, dummy.oldEncryptedVotesC1, dummy.oldEncryptedVotesC1],
      oldEncryptedVotesC2: [identity.c2, identity.c2, dummy.oldEncryptedVotesC2, dummy.oldEncryptedVotesC2],
      leafIndex: [BigInt(firstInsert.leafIndex), BigInt(secondInsert.leafIndex), dummy.leafIndex, dummy.leafIndex],
      leafNextKey: [firstInsert.leafNextKey, secondInsert.leafNextKey, dummy.leafNextKey, dummy.leafNextKey],
      leafPath: [zeroPath(), dummy.leafPath, dummy.leafPath, dummy.leafPath],
      slotPath: [firstInsert.slotPath, secondInsert.slotPath, dummy.slotPath, dummy.slotPath],
      predecessorIndex: [
        BigInt(firstInsert.predecessorIndex),
        BigInt(secondInsert.predecessorIndex),
        dummy.predecessorIndex,
        dummy.predecessorIndex,
      ],
      predecessorKey: [
        firstInsert.predecessorKey,
        secondInsert.predecessorKey,
        dummy.predecessorKey,
        dummy.predecessorKey,
      ],
      predecessorNextKey: [
        firstInsert.predecessorNextKey,
        secondInsert.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
      ],
      predecessorValue: [
        firstInsert.predecessorValue,
        secondInsert.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
      ],
      predecessorPath: [
        firstInsert.predecessorPath,
        secondInsert.predecessorPath,
        dummy.predecessorPath,
        dummy.predecessorPath,
      ],
    });

    await circuit.expectConstraintPass(witness);
  });

  test("should fail when the new chain hash omits a Ballot", async () => {
    const pollId = 1n;
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const userCommitment = poseidon2([3n, pollId]);
    const encrypted = await encryptVotes({
      votes: [1n, 0n, 0n, 0n, 0n],
      random: [9n, 12n, 56n, 3n, 2n],
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));
    const dummy = dummySlot();
    const identity = identityCiphertexts(VOTE_OPTIONS);

    await circuit.expectFail({
      pollId,
      realBallotCount: 1n,
      currentChainHash: 0n,
      newChainHash: 0n,
      currentLiveRoot,
      newLiveRoot: tree.root,
      currentAccumulatorC1: identity.c1,
      currentAccumulatorC2: identity.c2,
      newAccumulatorC1: encrypted.c1,
      newAccumulatorC2: encrypted.c2,
      isNew: [1n, dummy.isNew, dummy.isNew, dummy.isNew],
      userCommitment: [userCommitment, dummy.userCommitment, dummy.userCommitment, dummy.userCommitment],
      encryptedVotesC1: [encrypted.c1, dummy.encryptedVotesC1, dummy.encryptedVotesC1, dummy.encryptedVotesC1],
      encryptedVotesC2: [encrypted.c2, dummy.encryptedVotesC2, dummy.encryptedVotesC2, dummy.encryptedVotesC2],
      oldEncryptedVotesC1: [
        identity.c1,
        dummy.oldEncryptedVotesC1,
        dummy.oldEncryptedVotesC1,
        dummy.oldEncryptedVotesC1,
      ],
      oldEncryptedVotesC2: [
        identity.c2,
        dummy.oldEncryptedVotesC2,
        dummy.oldEncryptedVotesC2,
        dummy.oldEncryptedVotesC2,
      ],
      leafIndex: [BigInt(inserted.leafIndex), dummy.leafIndex, dummy.leafIndex, dummy.leafIndex],
      leafNextKey: [inserted.leafNextKey, dummy.leafNextKey, dummy.leafNextKey, dummy.leafNextKey],
      leafPath: [zeroPath(), dummy.leafPath, dummy.leafPath, dummy.leafPath],
      slotPath: [inserted.slotPath, dummy.slotPath, dummy.slotPath, dummy.slotPath],
      predecessorIndex: [
        BigInt(inserted.predecessorIndex),
        dummy.predecessorIndex,
        dummy.predecessorIndex,
        dummy.predecessorIndex,
      ],
      predecessorKey: [inserted.predecessorKey, dummy.predecessorKey, dummy.predecessorKey, dummy.predecessorKey],
      predecessorNextKey: [
        inserted.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
      ],
      predecessorValue: [
        inserted.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
      ],
      predecessorPath: [inserted.predecessorPath, dummy.predecessorPath, dummy.predecessorPath, dummy.predecessorPath],
    });
  });

  test("should fail when a real user commitment is zero", async () => {
    const dummy = dummySlot();
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const identity = identityCiphertexts(VOTE_OPTIONS);

    await circuit.expectFail({
      pollId: 1n,
      realBallotCount: 1n,
      currentChainHash: 0n,
      newChainHash: 1n,
      currentLiveRoot: tree.root,
      newLiveRoot: tree.root,
      currentAccumulatorC1: identity.c1,
      currentAccumulatorC2: identity.c2,
      newAccumulatorC1: identity.c1,
      newAccumulatorC2: identity.c2,
      isNew: [1n, dummy.isNew, dummy.isNew, dummy.isNew],
      userCommitment: [0n, dummy.userCommitment, dummy.userCommitment, dummy.userCommitment],
      encryptedVotesC1: [
        dummy.encryptedVotesC1,
        dummy.encryptedVotesC1,
        dummy.encryptedVotesC1,
        dummy.encryptedVotesC1,
      ],
      encryptedVotesC2: [
        dummy.encryptedVotesC2,
        dummy.encryptedVotesC2,
        dummy.encryptedVotesC2,
        dummy.encryptedVotesC2,
      ],
      oldEncryptedVotesC1: [
        identity.c1,
        dummy.oldEncryptedVotesC1,
        dummy.oldEncryptedVotesC1,
        dummy.oldEncryptedVotesC1,
      ],
      oldEncryptedVotesC2: [
        identity.c2,
        dummy.oldEncryptedVotesC2,
        dummy.oldEncryptedVotesC2,
        dummy.oldEncryptedVotesC2,
      ],
      leafIndex: [dummy.leafIndex, dummy.leafIndex, dummy.leafIndex, dummy.leafIndex],
      leafNextKey: [dummy.leafNextKey, dummy.leafNextKey, dummy.leafNextKey, dummy.leafNextKey],
      leafPath: [dummy.leafPath, dummy.leafPath, dummy.leafPath, dummy.leafPath],
      slotPath: [dummy.slotPath, dummy.slotPath, dummy.slotPath, dummy.slotPath],
      predecessorIndex: [
        dummy.predecessorIndex,
        dummy.predecessorIndex,
        dummy.predecessorIndex,
        dummy.predecessorIndex,
      ],
      predecessorKey: [dummy.predecessorKey, dummy.predecessorKey, dummy.predecessorKey, dummy.predecessorKey],
      predecessorNextKey: [
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
        dummy.predecessorNextKey,
      ],
      predecessorValue: [
        dummy.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
        dummy.predecessorValue,
      ],
      predecessorPath: [dummy.predecessorPath, dummy.predecessorPath, dummy.predecessorPath, dummy.predecessorPath],
    });
  });
});
