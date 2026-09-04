import { buildBabyjub } from "circomlibjs";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { beforeAll, describe, test } from "vitest";

import type { EncryptedBallot, TallySlotWitness } from "./utils/index.js";
import type { WitnessTester } from "circomkit";

import { LiveBallotTree, identityCiphertexts, liveBallotValue } from "../ts/liveBallotTree.js";
import { decryptVotes, encryptVotes } from "../ts/votes.js";

import {
  BATCH_SIZE,
  LIVE_TREE_DEPTH,
  VOTE_OPTIONS,
  batchFromSlots,
  circomkitInstance,
  dummySlot,
  zeroPath,
} from "./utils/index.js";

describe("Tally E2E", () => {
  let tallyBatch: WitnessTester<string[]>;
  let tallyFinalize: WitnessTester<
    ["pollPrivateKey", "pollPublicKey", "accumulatorC1", "accumulatorC2", "tallyTotals"]
  >;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    tallyBatch = await circomkitInstance.WitnessTester("TallyBatch", {
      file: "tally/TallyBatch",
      template: "TallyBatch",
      params: [BATCH_SIZE, VOTE_OPTIONS, LIVE_TREE_DEPTH],
    });

    tallyFinalize = await circomkitInstance.WitnessTester("TallyFinalize", {
      file: "tally/TallyFinalize",
      template: "TallyFinalize",
      params: [VOTE_OPTIONS],
    });

    babyJub = await buildBabyjub();
  });

  test("should open last-wins totals after three batches", async () => {
    const pollId = 1n;
    const pollPrivateKey = 7n;
    const pollPublicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, pollPrivateKey);
    const pollPublicKey: [bigint, bigint] = [
      babyJub.F.toObject(pollPublicKeyPoint[0]),
      babyJub.F.toObject(pollPublicKeyPoint[1]),
    ];
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);

    const addPoints = (left: [bigint, bigint], right: [bigint, bigint]): [bigint, bigint] => {
      const sum = babyJub.addPoint(
        [babyJub.F.e(left[0]), babyJub.F.e(left[1])],
        [babyJub.F.e(right[0]), babyJub.F.e(right[1])],
      );

      return [babyJub.F.toObject(sum[0]), babyJub.F.toObject(sum[1])] as [bigint, bigint];
    };

    const negatePoint = (point: [bigint, bigint]): [bigint, bigint] =>
      [babyJub.F.toObject(babyJub.F.neg(babyJub.F.e(point[0]))), point[1]] as [bigint, bigint];

    const combineCiphertexts = (
      current: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      oldCiphertext: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      newCiphertext: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
    ): { c1: [bigint, bigint][]; c2: [bigint, bigint][] } => ({
      c1: current.c1.map((point, index) =>
        addPoints(addPoints(point, negatePoint(oldCiphertext.c1[index])), newCiphertext.c1[index]),
      ),
      c2: current.c2.map((point, index) =>
        addPoints(addPoints(point, negatePoint(oldCiphertext.c2[index])), newCiphertext.c2[index]),
      ),
    });

    const encryptBallot = async (
      userPrivateKey: bigint,
      votes: bigint[],
      random: bigint[],
    ): Promise<EncryptedBallot> => {
      const userCommitment = poseidon2([userPrivateKey, pollId]);
      const encrypted = await encryptVotes({
        votes,
        random,
        pollId,
        userCommitment,
        publicKey: pollPublicKey,
      });

      return { userCommitment, ...encrypted };
    };

    const insertSlot = (
      userCommitment: bigint,
      encrypted: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
    ): TallySlotWitness => {
      const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));

      return {
        isNew: 1n,
        userCommitment,
        encryptedVotesC1: encrypted.c1,
        encryptedVotesC2: encrypted.c2,
        oldEncryptedVotesC1: identity.c1,
        oldEncryptedVotesC2: identity.c2,
        leafIndex: BigInt(inserted.leafIndex),
        leafNextKey: inserted.leafNextKey,
        leafPath: zeroPath(),
        slotPath: inserted.slotPath,
        predecessorIndex: BigInt(inserted.predecessorIndex),
        predecessorKey: inserted.predecessorKey,
        predecessorNextKey: inserted.predecessorNextKey,
        predecessorValue: inserted.predecessorValue,
        predecessorPath: inserted.predecessorPath,
      };
    };

    const updateSlot = (
      userCommitment: bigint,
      encrypted: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      oldEncrypted: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
    ): TallySlotWitness => {
      const updated = tree.update(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));
      const dummy = dummySlot();

      return {
        isNew: 0n,
        userCommitment,
        encryptedVotesC1: encrypted.c1,
        encryptedVotesC2: encrypted.c2,
        oldEncryptedVotesC1: oldEncrypted.c1,
        oldEncryptedVotesC2: oldEncrypted.c2,
        leafIndex: BigInt(updated.leafIndex),
        leafNextKey: updated.leafNextKey,
        leafPath: updated.leafPath,
        slotPath: dummy.slotPath,
        predecessorIndex: dummy.predecessorIndex,
        predecessorKey: dummy.predecessorKey,
        predecessorNextKey: dummy.predecessorNextKey,
        predecessorValue: dummy.predecessorValue,
        predecessorPath: dummy.predecessorPath,
      };
    };

    const proveBatch = async (
      realBallotCount: bigint,
      currentChainHash: bigint,
      newChainHash: bigint,
      currentLiveRoot: bigint,
      newLiveRoot: bigint,
      currentAccumulator: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      newAccumulator: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      slots: TallySlotWitness[],
    ): Promise<void> => {
      const witness = await tallyBatch.calculateWitness({
        pollId,
        realBallotCount,
        currentChainHash,
        newChainHash,
        currentLiveRoot,
        newLiveRoot,
        currentAccumulatorC1: currentAccumulator.c1,
        currentAccumulatorC2: currentAccumulator.c2,
        newAccumulatorC1: newAccumulator.c1,
        newAccumulatorC2: newAccumulator.c2,
        ...batchFromSlots(slots),
      });

      await tallyBatch.expectConstraintPass(witness);
    };

    const [firstA, firstB, firstC, firstD, secondA, firstE, firstF, secondB, firstG, secondC] = await Promise.all([
      encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]),
      encryptBallot(5n, [0n, 1n, 0n, 0n, 0n], [4n, 8n, 15n, 16n, 23n]),
      encryptBallot(7n, [0n, 0n, 1n, 0n, 0n], [11n, 13n, 17n, 19n, 29n]),
      encryptBallot(11n, [0n, 0n, 0n, 1n, 0n], [31n, 37n, 41n, 43n, 47n]),
      encryptBallot(3n, [0n, 0n, 0n, 0n, 4n], [53n, 59n, 61n, 67n, 71n]),
      encryptBallot(13n, [1n, 0n, 0n, 0n, 0n], [73n, 79n, 83n, 89n, 97n]),
      encryptBallot(17n, [0n, 2n, 0n, 0n, 0n], [101n, 103n, 107n, 109n, 113n]),
      encryptBallot(5n, [0n, 0n, 0n, 2n, 0n], [127n, 131n, 137n, 139n, 149n]),
      encryptBallot(19n, [0n, 0n, 3n, 0n, 0n], [151n, 157n, 163n, 167n, 173n]),
      encryptBallot(7n, [0n, 0n, 0n, 0n, 1n], [179n, 181n, 191n, 193n, 197n]),
    ]);

    let chainHash = 0n;
    const liveRoot = tree.root;
    let accumulator = identity;

    const runInsert = (ballot: EncryptedBallot): TallySlotWitness => {
      const slot = insertSlot(ballot.userCommitment, ballot);
      chainHash = poseidon2([chainHash, ballot.ballotHash]);
      accumulator = combineCiphertexts(accumulator, identity, ballot);

      return slot;
    };

    const runUpdate = (
      ballot: EncryptedBallot,
      oldEncrypted: Omit<EncryptedBallot, "userCommitment" | "ballotHash">,
    ): TallySlotWitness => {
      const slot = updateSlot(ballot.userCommitment, ballot, oldEncrypted);
      chainHash = poseidon2([chainHash, ballot.ballotHash]);
      accumulator = combineCiphertexts(accumulator, oldEncrypted, ballot);

      return slot;
    };

    const batch1Root = liveRoot;
    const batch1Acc = accumulator;
    const batch1Chain = chainHash;
    const batch1Slots = [runInsert(firstA), runInsert(firstB), runInsert(firstC), runInsert(firstD)];
    await proveBatch(4n, batch1Chain, chainHash, batch1Root, tree.root, batch1Acc, accumulator, batch1Slots);

    const batch2Root = tree.root;
    const batch2Acc = accumulator;
    const batch2Chain = chainHash;
    const batch2Slots = [runUpdate(secondA, firstA), runInsert(firstE), runInsert(firstF), runUpdate(secondB, firstB)];
    await proveBatch(4n, batch2Chain, chainHash, batch2Root, tree.root, batch2Acc, accumulator, batch2Slots);

    const batch3Root = tree.root;
    const batch3Acc = accumulator;
    const batch3Chain = chainHash;
    const batch3Slots = [runInsert(firstG), runUpdate(secondC, firstC)];
    await proveBatch(2n, batch3Chain, chainHash, batch3Root, tree.root, batch3Acc, accumulator, batch3Slots);

    const messagePoints = await decryptVotes({
      privateKey: pollPrivateKey,
      c1: accumulator.c1,
      c2: accumulator.c2,
    });

    const tallyTotals = messagePoints.map((point: [bigint, bigint]): bigint => {
      for (let total = 0n; total <= 64n; total += 1n) {
        const candidate = babyJub.mulPointEscalar(babyJub.Base8, total);

        if (babyJub.F.eq(candidate[0], babyJub.F.e(point[0])) && babyJub.F.eq(candidate[1], babyJub.F.e(point[1]))) {
          return total;
        }
      }

      throw new Error("tally total discrete log not found");
    });

    const finalizeWitness = await tallyFinalize.calculateWitness({
      pollPrivateKey,
      pollPublicKey,
      accumulatorC1: accumulator.c1,
      accumulatorC2: accumulator.c2,
      tallyTotals,
    });

    await tallyFinalize.expectConstraintPass(finalizeWitness);
  });
});
