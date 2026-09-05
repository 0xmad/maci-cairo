import { buildBabyjub } from "circomlibjs";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { beforeAll, describe, test } from "vitest";

import type { TallyBatchSignals } from "./utils/index.js";
import type { WitnessTester } from "circomkit";

import { LiveBallotTree, identityCiphertexts, liveBallotValue } from "../ts/liveBallotTree.js";
import { encryptVotes } from "../ts/votes.js";

import {
  BATCH_SIZE,
  LIVE_TREE_DEPTH,
  VOTE_OPTIONS,
  addAffine,
  circomkitInstance,
  dummySlot,
  insertSlot,
  pollPublicKeyFrom,
  tallyBatchWitness,
  updateSlot,
} from "./utils/index.js";

describe("TallyBatch", () => {
  let circuit: WitnessTester<TallyBatchSignals>;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    [circuit, babyJub] = await Promise.all([
      circomkitInstance.WitnessTester("TallyBatch", {
        file: "tally/TallyBatch",
        template: "TallyBatch",
        params: [BATCH_SIZE, VOTE_OPTIONS, LIVE_TREE_DEPTH],
      }),
      buildBabyjub(),
    ]);
  });

  const encryptBallot = async (userPrivateKey: bigint, votes: bigint[], random: bigint[]) => {
    const pollId = 1n;
    const pollPublicKey = pollPublicKeyFrom(babyJub, 7n);
    const userCommitment = poseidon2([userPrivateKey, pollId]);
    const encrypted = await encryptVotes({
      votes,
      random,
      pollId,
      userCommitment,
      publicKey: pollPublicKey,
    });

    return { pollId, userCommitment, encrypted };
  };

  test("should leave state unchanged when realBallotCount is 0", async () => {
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const accumulator = identityCiphertexts(VOTE_OPTIONS);

    const witness = await circuit.calculateWitness(
      tallyBatchWitness(
        {
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
        },
        [],
      ),
    );

    await circuit.expectConstraintPass(witness);
  });

  test("should insert the first Ballot and absorb it into the chain hash", async () => {
    const { pollId, userCommitment, encrypted } = await encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));

    const witness = await circuit.calculateWitness(
      tallyBatchWitness(
        {
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
        },
        [insertSlot(userCommitment, encrypted, inserted, identity)],
      ),
    );

    await circuit.expectConstraintPass(witness);
  });

  test("should supersede an earlier Ballot for the same user commitment", async () => {
    const [first, second] = await Promise.all([
      encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]),
      encryptBallot(3n, [0n, 2n, 0n, 0n, 0n], [4n, 8n, 15n, 16n, 23n]),
    ]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const firstInsert = tree.insert(first.userCommitment, liveBallotValue(first.encrypted.c1, first.encrypted.c2));
    const secondUpdate = tree.update(second.userCommitment, liveBallotValue(second.encrypted.c1, second.encrypted.c2));
    const chainAfterFirst = poseidon2([0n, first.encrypted.ballotHash]);

    const witness = await circuit.calculateWitness(
      tallyBatchWitness(
        {
          pollId: first.pollId,
          realBallotCount: 2n,
          currentChainHash: 0n,
          newChainHash: poseidon2([chainAfterFirst, second.encrypted.ballotHash]),
          currentLiveRoot,
          newLiveRoot: tree.root,
          currentAccumulatorC1: identity.c1,
          currentAccumulatorC2: identity.c2,
          newAccumulatorC1: second.encrypted.c1,
          newAccumulatorC2: second.encrypted.c2,
        },
        [
          insertSlot(first.userCommitment, first.encrypted, firstInsert, identity),
          updateSlot(second.userCommitment, second.encrypted, first.encrypted, secondUpdate),
        ],
      ),
    );

    await circuit.expectConstraintPass(witness);
  });

  test("should add live ciphertexts from two user commitments", async () => {
    const [first, second] = await Promise.all([
      encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]),
      encryptBallot(5n, [0n, 2n, 0n, 0n, 0n], [4n, 8n, 15n, 16n, 23n]),
    ]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const firstInsert = tree.insert(first.userCommitment, liveBallotValue(first.encrypted.c1, first.encrypted.c2));
    const secondInsert = tree.insert(second.userCommitment, liveBallotValue(second.encrypted.c1, second.encrypted.c2));
    const chainAfterFirst = poseidon2([0n, first.encrypted.ballotHash]);

    const witness = await circuit.calculateWitness(
      tallyBatchWitness(
        {
          pollId: first.pollId,
          realBallotCount: 2n,
          currentChainHash: 0n,
          newChainHash: poseidon2([chainAfterFirst, second.encrypted.ballotHash]),
          currentLiveRoot,
          newLiveRoot: tree.root,
          currentAccumulatorC1: identity.c1,
          currentAccumulatorC2: identity.c2,
          newAccumulatorC1: first.encrypted.c1.map((point, index) =>
            addAffine(babyJub, point, second.encrypted.c1[index]),
          ),
          newAccumulatorC2: first.encrypted.c2.map((point, index) =>
            addAffine(babyJub, point, second.encrypted.c2[index]),
          ),
        },
        [
          insertSlot(first.userCommitment, first.encrypted, firstInsert, identity),
          insertSlot(second.userCommitment, second.encrypted, secondInsert, identity),
        ],
      ),
    );

    await circuit.expectConstraintPass(witness);
  });

  test("should fail when the new chain hash omits a Ballot", async () => {
    const { pollId, userCommitment, encrypted } = await encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));

    await circuit.expectFail(
      tallyBatchWitness(
        {
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
        },
        [insertSlot(userCommitment, encrypted, inserted, identity)],
      ),
    );
  });

  test("should fail when a real user commitment is zero", async () => {
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const identity = identityCiphertexts(VOTE_OPTIONS);

    await circuit.expectFail(
      tallyBatchWitness(
        {
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
        },
        [{ ...dummySlot(), isNew: 1n, userCommitment: 0n }],
      ),
    );
  });

  test("should fail when the insert predecessor gap does not contain the user commitment", async () => {
    const [first, second] = await Promise.all([
      encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]),
      encryptBallot(5n, [0n, 2n, 0n, 0n, 0n], [4n, 8n, 15n, 16n, 23n]),
    ]);
    const low = first.userCommitment < second.userCommitment ? first : second;
    const high = first.userCommitment < second.userCommitment ? second : first;
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const lowInsert = tree.insert(low.userCommitment, liveBallotValue(low.encrypted.c1, low.encrypted.c2));
    const sentinelAfterLow = tree.path(0);
    const highInsert = tree.insert(high.userCommitment, liveBallotValue(high.encrypted.c1, high.encrypted.c2));
    const chainAfterLow = poseidon2([0n, low.encrypted.ballotHash]);
    const highSlot = insertSlot(high.userCommitment, high.encrypted, highInsert, identity);

    await circuit.expectFail(
      tallyBatchWitness(
        {
          pollId: first.pollId,
          realBallotCount: 2n,
          currentChainHash: 0n,
          newChainHash: poseidon2([chainAfterLow, high.encrypted.ballotHash]),
          currentLiveRoot,
          newLiveRoot: tree.root,
          currentAccumulatorC1: identity.c1,
          currentAccumulatorC2: identity.c2,
          newAccumulatorC1: low.encrypted.c1.map((point, index) => addAffine(babyJub, point, high.encrypted.c1[index])),
          newAccumulatorC2: low.encrypted.c2.map((point, index) => addAffine(babyJub, point, high.encrypted.c2[index])),
        },
        [
          insertSlot(low.userCommitment, low.encrypted, lowInsert, identity),
          {
            ...highSlot,
            predecessorIndex: 0n,
            predecessorKey: 0n,
            predecessorNextKey: low.userCommitment,
            predecessorValue: 0n,
            predecessorPath: sentinelAfterLow.siblings,
          },
        ],
      ),
    );
  });

  test("should fail when a dummy slot is marked as a first-seen Ballot", async () => {
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const accumulator = identityCiphertexts(VOTE_OPTIONS);

    await circuit.expectFail(
      tallyBatchWitness(
        {
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
        },
        [{ ...dummySlot(), isNew: 1n }],
      ),
    );
  });

  test("should fail when a dummy slot carries a non-identity ciphertext", async () => {
    const { pollId, userCommitment, encrypted } = await encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));
    const dummy = dummySlot();

    await circuit.expectFail(
      tallyBatchWitness(
        {
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
        },
        [
          insertSlot(userCommitment, encrypted, inserted, identity),
          { ...dummy, encryptedVotesC1: encrypted.c1, encryptedVotesC2: encrypted.c2 },
        ],
      ),
    );
  });

  test("should fail when the new live-ballot root is wrong", async () => {
    const { pollId, userCommitment, encrypted } = await encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));

    await circuit.expectFail(
      tallyBatchWitness(
        {
          pollId,
          realBallotCount: 1n,
          currentChainHash: 0n,
          newChainHash: poseidon2([0n, encrypted.ballotHash]),
          currentLiveRoot,
          newLiveRoot: 0n,
          currentAccumulatorC1: identity.c1,
          currentAccumulatorC2: identity.c2,
          newAccumulatorC1: encrypted.c1,
          newAccumulatorC2: encrypted.c2,
        },
        [insertSlot(userCommitment, encrypted, inserted, identity)],
      ),
    );
  });

  test("should fail when the new accumulator is wrong", async () => {
    const { pollId, userCommitment, encrypted } = await encryptBallot(3n, [1n, 0n, 0n, 0n, 0n], [9n, 12n, 56n, 3n, 2n]);
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const currentLiveRoot = tree.root;
    const identity = identityCiphertexts(VOTE_OPTIONS);
    const inserted = tree.insert(userCommitment, liveBallotValue(encrypted.c1, encrypted.c2));

    await circuit.expectFail(
      tallyBatchWitness(
        {
          pollId,
          realBallotCount: 1n,
          currentChainHash: 0n,
          newChainHash: poseidon2([0n, encrypted.ballotHash]),
          currentLiveRoot,
          newLiveRoot: tree.root,
          currentAccumulatorC1: identity.c1,
          currentAccumulatorC2: identity.c2,
          newAccumulatorC1: identity.c1,
          newAccumulatorC2: identity.c2,
        },
        [insertSlot(userCommitment, encrypted, inserted, identity)],
      ),
    );
  });

  test("should fail when realBallotCount exceeds BATCH_SIZE", async () => {
    const tree = new LiveBallotTree(LIVE_TREE_DEPTH);
    const accumulator = identityCiphertexts(VOTE_OPTIONS);

    await circuit.expectFail(
      tallyBatchWitness(
        {
          pollId: 1n,
          realBallotCount: BigInt(BATCH_SIZE + 1),
          currentChainHash: 0n,
          newChainHash: 0n,
          currentLiveRoot: tree.root,
          newLiveRoot: tree.root,
          currentAccumulatorC1: accumulator.c1,
          currentAccumulatorC2: accumulator.c2,
          newAccumulatorC1: accumulator.c1,
          newAccumulatorC2: accumulator.c2,
        },
        [],
      ),
    );
  });
});
