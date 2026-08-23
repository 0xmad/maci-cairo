import { type BigNumberish, buildBabyjub } from "circomlibjs";
import { poseidon6 } from "poseidon-lite/poseidon6";

import type { SameLength } from "./types.js";

/**
 * Arguments used to encrypt a set of votes.
 *
 * `votes` and `random` must have the same length. Each vote is encrypted
 * using the corresponding random scalar at the same index.
 *
 * @typeParam T1 - The type of the vote values.
 * @typeParam T2 - The type of the random scalars.
 *
 * @property votes - Vote values to encrypt.
 * @property random - Random scalars used for each vote.
 * @property publicKey - BabyJub public key as an `[x, y]` point.
 * @property pollId - poll ID.
 * @property userCommitment - user commitment value
 *
 * @example
 * ```ts
 * const args: TEncryptVotesArgs<[1n, 0n], [123n, 456n]> = {
 *   votes: [1n, 0n],
 *   random: [123n, 456n],
 *   pollId: 1n,
 *   userCommitment: 789n,
 *   publicKey: [publicKeyX, publicKeyY],
 * };
 * ```
 */
export type TEncryptVotesArgs<
  T1 extends BigNumberish[],
  T2 extends BigNumberish[],
> =
  SameLength<T1, T2> extends true
    ? {
        votes: T1;
        random: T2;
        pollId: bigint;
        userCommitment: bigint;
        publicKey: [bigint, bigint];
      }
    : never;

/**
 * Result of encrypting a set of votes with BabyJubJub.
 *
 * Each vote produces a ciphertext consisting of two elliptic-curve points:
 * `c1 = rG` and `c2 = mG + rA`.
 */
export interface IEncryptVotesReturn {
  /**
   * Ephemeral public-key points derived from the random scalars
   */
  c1: [bigint, bigint][];

  /**
   * Encrypted vote points
   */
  c2: [bigint, bigint][];

  /**
   * Ballot hash (consist of poll id, user commitment, total C1, total C2)
   */
  ballotHash: bigint;
}

/**
 * Encrypts votes using BabyJubJub elliptic-curve points.
 *
 * For each vote `m` and corresponding random scalar `r`, the ciphertext is
 * computed as:
 *
 * - `c1 = rG`
 * - `c2 = mG + rA`
 *
 * where `G` is the BabyJub base point and `A` is the supplied public key.
 *
 * The resulting ciphertext can be used with the corresponding private key
 * to recover the encoded vote point.
 *
 * @param args - Votes, random scalars, and the recipient's public key.
 * @returns The encrypted votes as pairs of BabyJubJub points and ballot hash.
 *
 * @throws May reject if BabyJubJub initialization fails.
 *
 * @example
 * ```ts
 * const { c1, c2 } = await encryptVotes({
 *   votes: [1n, 0n],
 *   random: [123n, 456n],
 *   publicKey: [publicKeyX, publicKeyY],
 *   pollId: 1n,
 *   userCommiment: 789n,
 * });
 * ```
 */
export const encryptVotes = async <T1 extends bigint[], T2 extends bigint[]>({
  votes,
  random,
  publicKey,
  pollId,
  userCommitment,
}: TEncryptVotesArgs<T1, T2>): Promise<IEncryptVotesReturn> => {
  const babyJub = await buildBabyjub();
  const c1: [bigint, bigint][] = [];
  const c2: [bigint, bigint][] = [];

  for (let index = 0; index < votes.length; index += 1) {
    const mG = babyJub.mulPointEscalar(babyJub.Base8, votes[index]);
    const rG = babyJub.mulPointEscalar(babyJub.Base8, random[index]);
    const rA = babyJub.mulPointEscalar(
      [babyJub.F.e(publicKey[0]), babyJub.F.e(publicKey[1])],
      random[index],
    );

    const mGrA = babyJub.addPoint(mG, rA);
    c1.push([babyJub.F.toObject(rG[0]), babyJub.F.toObject(rG[1])]);
    c2.push([babyJub.F.toObject(mGrA[0]), babyJub.F.toObject(mGrA[1])]);
  }

  const totalC1 = c1.reduce(
    (acc, [x, y]) => babyJub.addPoint(acc, [babyJub.F.e(x), babyJub.F.e(y)]),
    babyJub.mulPointEscalar(babyJub.Base8, 0),
  );

  const totalC2 = c2.reduce(
    (acc, [x, y]) => babyJub.addPoint(acc, [babyJub.F.e(x), babyJub.F.e(y)]),
    babyJub.mulPointEscalar(babyJub.Base8, 0),
  );

  const ballotHash = poseidon6([
    pollId,
    userCommitment,
    babyJub.F.toObject(totalC1[0]),
    babyJub.F.toObject(totalC1[1]),
    babyJub.F.toObject(totalC2[0]),
    babyJub.F.toObject(totalC2[1]),
  ]);

  return { c1, c2, ballotHash };
};
