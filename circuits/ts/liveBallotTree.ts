import { poseidon2 } from "poseidon-lite/poseidon2";
import { poseidon3 } from "poseidon-lite/poseidon3";
import { poseidon4 } from "poseidon-lite/poseidon4";

/**
 * Off-chain live-ballot tree used to build TallyBatch witnesses.
 *
 * The tree is an indexed Merkle tree ordered by user commitment. It is not
 * the state tree and not a LeanIMT. Index 0 holds the sentinel key `0`.
 * Empty slots hash as `0`. A live leaf value is Poseidon of per-option
 * ciphertext hashes, not the ballot hash (which sums options).
 *
 * Last-wins: `insert` for a first-seen user commitment, `update` when a later
 * Ballot supersedes the same commitment.
 *
 * @packageDocumentation
 */

/**
 * BabyJub affine point `[x, y]`.
 */
export type BabyJubPoint = [bigint, bigint];

/**
 * BabyJub additive identity `(0, 1)`. Dummy tally slots and first-seen
 * Ballots use this as the previous (and, for dummies, new) ciphertext.
 */
export const IDENTITY_POINT: BabyJubPoint = [0n, 1n];

/**
 * One occupied live-ballot leaf.
 *
 * @property key - User commitment. Nonzero for real Ballots; `0` is the sentinel.
 * @property nextKey - Next user commitment in sorted order, or `0` if this leaf ends the list.
 * @property value - `liveBallotValue` digest of the current live ciphertexts.
 */
export interface LiveBallotSlot {
  key: bigint;
  nextKey: bigint;
  value: bigint;
}

/**
 * Poseidon(2) Merkle path for one leaf.
 *
 * @property index - Leaf index.
 * @property siblings - Sibling hashes from the leaf toward the root.
 * @property root - Tree root after hashing those siblings.
 */
export interface MerklePath {
  index: number;
  siblings: bigint[];
  root: bigint;
}

/**
 * Per-option ElGamal ciphertext arrays (`c1[i] = rG`, `c2[i] = mG + rA`).
 *
 * @property c1 - Ephemeral public-key points, one per vote option.
 * @property c2 - Encrypted vote points, one per vote option.
 */
export interface ElGamalCiphertexts {
  c1: BabyJubPoint[];
  c2: BabyJubPoint[];
}

/**
 * Witness for inserting a first-seen user commitment into the live-ballot tree.
 *
 * Matches the insert-side private signals of `ProcessTallyBallot`: splice the
 * commitment into the predecessor gap, then write an empty slot.
 *
 * @property predecessorIndex - Leaf index of the predecessor in the sorted list.
 * @property predecessorKey - Predecessor user commitment.
 * @property predecessorNextKey - Predecessor `nextKey` before the splice.
 * @property predecessorValue - Predecessor live-ballot leaf value.
 * @property predecessorPath - Merkle siblings for the predecessor leaf.
 * @property leafIndex - Empty slot that becomes the new live leaf.
 * @property leafNextKey - Copied from the predecessor (`nextKey` of the new leaf).
 * @property slotPath - Merkle siblings for the empty slot (after the predecessor update).
 */
export interface LiveBallotInsertWitness {
  predecessorIndex: number;
  predecessorKey: bigint;
  predecessorNextKey: bigint;
  predecessorValue: bigint;
  predecessorPath: bigint[];
  leafIndex: number;
  leafNextKey: bigint;
  slotPath: bigint[];
}

/**
 * Witness for rewriting an existing live-ballot leaf (revote / last-wins).
 *
 * Matches the update-side private signals of `ProcessTallyBallot`.
 *
 * @property leafIndex - Existing leaf for this user commitment.
 * @property leafNextKey - Unchanged next-key pointer on that leaf.
 * @property leafPath - Merkle siblings for the in-place update.
 */
export interface LiveBallotUpdateWitness {
  leafIndex: number;
  leafNextKey: bigint;
  leafPath: bigint[];
}

/**
 * Occupied slot together with its leaf index.
 *
 * @property index - Leaf index.
 * @property slot - Occupied live-ballot leaf.
 */
export interface LiveBallotTreeEntry {
  index: number;
  slot: LiveBallotSlot;
}

/**
 * Digest stored as a live-ballot leaf value.
 *
 * Each vote option is `Poseidon(4)` over `(c1.x, c1.y, c2.x, c2.y)`. The leaf
 * value is a `Poseidon(2)` fold of those option hashes, starting from `0`
 * (`digest = Poseidon(2)(digest, optionHash)`). This scales past circomlib's
 * `Poseidon(n)` limit of 16 inputs (100+ vote options). This is not the ballot
 * hash: the ballot hash Poseidon(6)-compresses the *sum* of C1/C2 across
 * options, which cannot be subtracted per option from the tally accumulator.
 *
 * @param c1 - Encrypted Votes C1, one point per vote option.
 * @param c2 - Encrypted Votes C2, one point per vote option.
 * @returns Poseidon(2) fold of the per-option ciphertext hashes.
 * @throws If `c1` and `c2` differ in length, or there are no vote options.
 */
export const liveBallotValue = (c1: BabyJubPoint[], c2: BabyJubPoint[]): bigint => {
  if (c1.length !== c2.length) {
    throw new Error("encrypted Votes C1 and C2 must have the same length");
  }

  if (c1.length === 0) {
    throw new Error("live-ballot value requires at least one vote option");
  }

  return c1.reduce((digest, point, index) => poseidon2([digest, poseidon4([...point, ...c2[index]])]), 0n);
};

/**
 * Per-option identity ciphertexts: every C1 and C2 is `IDENTITY_POINT`.
 *
 * Used for dummy tally slots and as the previous ciphertext on insert.
 *
 * @param voteOptions - Number of vote options.
 */
export const identityCiphertexts = (voteOptions: number): ElGamalCiphertexts => ({
  c1: Array.from({ length: voteOptions }, () => IDENTITY_POINT),
  c2: Array.from({ length: voteOptions }, () => IDENTITY_POINT),
});

/**
 * Indexed Merkle tree of live Ballots, keyed by user commitment.
 *
 * Capacity is `2 ** depth` slots. Slot 0 is the sentinel (`key = 0`,
 * `nextKey = 0`, `value = 0`). Occupied leaves hash as
 * `Poseidon(3)(key, nextKey, value)`; empty slots hash as `0`.
 */
export class LiveBallotTree {
  readonly depth: number;

  private readonly slots: (LiveBallotSlot | undefined)[];

  /**
   * @param depth - Merkle depth (`LIVE_TREE_DEPTH`). Capacity is `2 ** depth`.
   */
  constructor(depth: number) {
    this.depth = depth;
    this.slots = Array.from({ length: 2 ** depth });
    this.slots[0] = { key: 0n, nextKey: 0n, value: 0n };
  }

  /**
   * Current Merkle root.
   */
  get root(): bigint {
    return this.merklePath(this.leafHashes(), 0, this.depth).root;
  }

  /**
   * Merkle path for the leaf at `index`.
   */
  path(index: number): MerklePath {
    return this.merklePath(this.leafHashes(), index, this.depth);
  }

  /**
   * Insert a first-seen user commitment into the predecessor gap.
   *
   * Updates the predecessor's `nextKey`, then writes the new leaf into the
   * next empty slot (lowest index greater than 0).
   *
   * @param key - Nonzero user commitment.
   * @param value - `liveBallotValue` of the Ballot's ciphertexts.
   * @returns Insert witness for `ProcessTallyBallot`.
   * @throws If the tree is full or no predecessor gap contains `key`.
   */
  insert(key: bigint, value: bigint): LiveBallotInsertWitness {
    const predecessorEntry = this.predecessor(key);
    const predecessorMerklePath = this.path(predecessorEntry.index);
    const predecessorNextKey = predecessorEntry.slot.nextKey;

    this.slots[predecessorEntry.index] = { ...predecessorEntry.slot, nextKey: key };

    const leafIndex = this.nextEmptyIndex();
    const slotPath = this.path(leafIndex).siblings;
    this.slots[leafIndex] = { key, nextKey: predecessorNextKey, value };

    return {
      predecessorIndex: predecessorEntry.index,
      predecessorKey: predecessorEntry.slot.key,
      predecessorNextKey,
      predecessorValue: predecessorEntry.slot.value,
      predecessorPath: predecessorMerklePath.siblings,
      leafIndex,
      leafNextKey: predecessorNextKey,
      slotPath,
    };
  }

  /**
   * Rewrite the live leaf for an existing user commitment (last-wins).
   *
   * `nextKey` is unchanged; only `value` is replaced.
   *
   * @param key - User commitment already in the tree.
   * @param value - `liveBallotValue` of the superseding Ballot.
   * @returns Update witness for `ProcessTallyBallot`.
   * @throws If `key` is not in the tree.
   */
  update(key: bigint, value: bigint): LiveBallotUpdateWitness {
    const found = this.find(key);
    const leafPath = this.path(found.index).siblings;
    const leafNextKey = found.slot.nextKey;

    this.slots[found.index] = { ...found.slot, value };

    return { leafIndex: found.index, leafNextKey, leafPath };
  }

  private leafHashes(): bigint[] {
    return this.slots.map((slot) => (slot === undefined ? 0n : poseidon3([slot.key, slot.nextKey, slot.value])));
  }

  private nextEmptyIndex(): number {
    const index = this.slots.findIndex((slot, slotIndex) => slotIndex > 0 && slot === undefined);

    if (index < 0) {
      throw new Error("live-ballot tree is full");
    }

    return index;
  }

  private find(key: bigint): LiveBallotTreeEntry {
    const index = this.slots.findIndex((slot) => slot?.key === key);
    const slot = this.slots[index];

    if (slot === undefined) {
      throw new Error("user commitment is not in the live-ballot tree");
    }

    return { index, slot };
  }

  private predecessor(key: bigint): LiveBallotTreeEntry {
    const found = this.slots
      .map((slot, index) => (slot === undefined ? undefined : { index, slot }))
      .find((entry) => {
        if (entry === undefined) {
          return false;
        }

        const endsList = entry.slot.nextKey === 0n;

        return entry.slot.key < key && (endsList || key < entry.slot.nextKey);
      });

    if (found === undefined) {
      throw new Error("no predecessor gap for user commitment");
    }

    return found;
  }

  private merklePath(leaves: bigint[], index: number, depth: number): MerklePath {
    const siblings: bigint[] = [];
    let level = [...leaves];
    let cursor = index;

    for (let layer = 0; layer < depth; layer += 1) {
      const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
      siblings.push(level[siblingIndex]);

      const next: bigint[] = [];

      for (let leafIndex = 0; leafIndex < level.length; leafIndex += 2) {
        next.push(poseidon2([level[leafIndex], level[leafIndex + 1]]));
      }

      level = next;
      cursor = Math.floor(cursor / 2);
    }

    return { index, siblings, root: level[0] };
  }
}
