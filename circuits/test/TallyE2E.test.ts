import { buildBabyjub } from "circomlibjs";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { beforeAll, describe, test } from "vitest";

import type { EncryptedBallot, TallyBatchPublicInputs, TallyBatchSignals, TallySlotWitness } from "./utils/index.js";
import type { BabyJubPoint } from "../ts/liveBallotTree.js";
import type { WitnessTester } from "circomkit";

import { LiveBallotTree, identityCiphertexts, liveBallotValue } from "../ts/liveBallotTree.js";
import { decryptVotes, encryptVotes } from "../ts/votes.js";

import {
  BATCH_SIZE,
  LIVE_TREE_DEPTH,
  VOTE_OPTIONS,
  addAffine,
  circomkitInstance,
  insertSlot,
  pollPublicKeyFrom,
  tallyBatchWitness,
  updateSlot,
} from "./utils/index.js";

describe("Tally E2E", () => {
  let tallyBatch: WitnessTester<TallyBatchSignals>;
  let tallyFinalize: WitnessTester<
    ["pollPrivateKey", "pollPublicKey", "accumulatorC1", "accumulatorC2", "tallyTotals"]
  >;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    [tallyBatch, tallyFinalize, babyJub] = await Promise.all([
      circomkitInstance.WitnessTester("TallyBatch", {
        file: "tally/TallyBatch",
        template: "TallyBatch",
        params: [BATCH_SIZE, VOTE_OPTIONS, LIVE_TREE_DEPTH],
      }),
      circomkitInstance.WitnessTester("TallyFinalize", {
        file: "tally/TallyFinalize",
        template: "TallyFinalize",
        params: [VOTE_OPTIONS],
      }),
      buildBabyjub(),
    ]);
  });

  test("should open last-wins totals after three batches", async () => {
    const pollId = 1n;
    const pollPrivateKey = 7n;
    const pollPublicKey = pollPublicKeyFrom(babyJub, pollPrivateKey);
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);

    const negatePoint = (point: BabyJubPoint): BabyJubPoint => [
      babyJub.F.toObject(babyJub.F.neg(babyJub.F.e(point[0]))),
      point[1],
    ];

    const combineCiphertexts = (
      current: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      oldCiphertext: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
      newCiphertext: { c1: [bigint, bigint][]; c2: [bigint, bigint][] },
    ): { c1: [bigint, bigint][]; c2: [bigint, bigint][] } => ({
      c1: current.c1.map((point, index) =>
        addAffine(babyJub, addAffine(babyJub, point, negatePoint(oldCiphertext.c1[index])), newCiphertext.c1[index]),
      ),
      c2: current.c2.map((point, index) =>
        addAffine(babyJub, addAffine(babyJub, point, negatePoint(oldCiphertext.c2[index])), newCiphertext.c2[index]),
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

    const proveBatch = async (pubs: TallyBatchPublicInputs, slots: TallySlotWitness[]): Promise<void> => {
      const witness = await tallyBatch.calculateWitness(tallyBatchWitness(pubs, slots));

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
      const inserted = tree.insert(ballot.userCommitment, liveBallotValue(ballot.c1, ballot.c2));
      const slot = insertSlot(ballot.userCommitment, ballot, inserted, identity);
      chainHash = poseidon2([chainHash, ballot.ballotHash]);
      accumulator = combineCiphertexts(accumulator, identity, ballot);

      return slot;
    };

    const runUpdate = (
      ballot: EncryptedBallot,
      oldEncrypted: Omit<EncryptedBallot, "userCommitment" | "ballotHash">,
    ): TallySlotWitness => {
      const updated = tree.update(ballot.userCommitment, liveBallotValue(ballot.c1, ballot.c2));
      const slot = updateSlot(ballot.userCommitment, ballot, oldEncrypted, updated);
      chainHash = poseidon2([chainHash, ballot.ballotHash]);
      accumulator = combineCiphertexts(accumulator, oldEncrypted, ballot);

      return slot;
    };

    const batch1Root = liveRoot;
    const batch1Acc = accumulator;
    const batch1Chain = chainHash;
    const batch1Slots = [runInsert(firstA), runInsert(firstB), runInsert(firstC), runInsert(firstD)];
    await proveBatch(
      {
        pollId,
        realBallotCount: 4n,
        currentChainHash: batch1Chain,
        newChainHash: chainHash,
        currentLiveRoot: batch1Root,
        newLiveRoot: tree.root,
        currentAccumulatorC1: batch1Acc.c1,
        currentAccumulatorC2: batch1Acc.c2,
        newAccumulatorC1: accumulator.c1,
        newAccumulatorC2: accumulator.c2,
      },
      batch1Slots,
    );

    const batch2Root = tree.root;
    const batch2Acc = accumulator;
    const batch2Chain = chainHash;
    const batch2Slots = [runUpdate(secondA, firstA), runInsert(firstE), runInsert(firstF), runUpdate(secondB, firstB)];
    await proveBatch(
      {
        pollId,
        realBallotCount: 4n,
        currentChainHash: batch2Chain,
        newChainHash: chainHash,
        currentLiveRoot: batch2Root,
        newLiveRoot: tree.root,
        currentAccumulatorC1: batch2Acc.c1,
        currentAccumulatorC2: batch2Acc.c2,
        newAccumulatorC1: accumulator.c1,
        newAccumulatorC2: accumulator.c2,
      },
      batch2Slots,
    );

    const batch3Root = tree.root;
    const batch3Acc = accumulator;
    const batch3Chain = chainHash;
    const batch3Slots = [runInsert(firstG), runUpdate(secondC, firstC)];
    await proveBatch(
      {
        pollId,
        realBallotCount: 2n,
        currentChainHash: batch3Chain,
        newChainHash: chainHash,
        currentLiveRoot: batch3Root,
        newLiveRoot: tree.root,
        currentAccumulatorC1: batch3Acc.c1,
        currentAccumulatorC2: batch3Acc.c2,
        newAccumulatorC1: accumulator.c1,
        newAccumulatorC2: accumulator.c2,
      },
      batch3Slots,
    );

    const messagePoints = await decryptVotes({
      privateKey: pollPrivateKey,
      c1: accumulator.c1,
      c2: accumulator.c2,
    });

    const tallyTotals = messagePoints.map((point: BabyJubPoint): bigint => {
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
