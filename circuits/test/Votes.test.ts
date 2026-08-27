import { buildBabyjub } from "circomlibjs";
import fc from "fast-check";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { encryptVotes } from "../ts/votes.js";

import { circomkitInstance, getSignalArray } from "./utils.js";

describe("Votes", () => {
  const VOTE_OPTIONS = 5;

  let encryptionCircuit: WitnessTester<["votes", "random", "publicKey"], ["c1", "c2"]>;
  let decryptionCircuit: WitnessTester<["privateKey", "c1", "c2"], ["out"]>;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    encryptionCircuit = await circomkitInstance.WitnessTester("VotesEncryption", {
      file: "vote/VotesEncryption",
      template: "VotesEncryption",
      params: [VOTE_OPTIONS],
    });

    decryptionCircuit = await circomkitInstance.WitnessTester("VotesDecryption", {
      file: "vote/VotesDecryption",
      template: "VotesDecryption",
      params: [VOTE_OPTIONS],
    });

    babyJub = await buildBabyjub();
  });

  test("should encrypt votes correctly", async () => {
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
        fc.bigInt({ min: 0n, max: babyJub.subOrder - 1n }),
        async (votes: bigint[], random: bigint[], privateKey: bigint, pollId: bigint) => {
          const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, privateKey);

          const publicKey: [bigint, bigint] = [
            babyJub.F.toObject(publicKeyPoint[0]),
            babyJub.F.toObject(publicKeyPoint[1]),
          ];

          const userCommitment = poseidon2([privateKey, pollId]);

          const encryptionWitness = await encryptionCircuit.calculateWitness({
            votes,
            random,
            publicKey,
          });

          const [c1, c2] = await Promise.all([
            getSignalArray(encryptionCircuit, encryptionWitness, "c1", VOTE_OPTIONS, 2),
            getSignalArray(encryptionCircuit, encryptionWitness, "c2", VOTE_OPTIONS, 2),
          ]);

          const encryptedVotes = await encryptVotes({
            votes,
            random,
            publicKey,
            pollId,
            userCommitment,
          });

          const isValidC1 = c1.every((point, index) => {
            const encryptedPoint = encryptedVotes.c1[index];

            return (
              babyJub.F.eq(babyJub.F.e(point[0]), babyJub.F.e(encryptedPoint[0])) &&
              babyJub.F.eq(babyJub.F.e(point[1]), babyJub.F.e(encryptedPoint[1]))
            );
          });

          const isValidC2 = c2.every((point, index) => {
            const encryptedPoint = encryptedVotes.c2[index];

            return (
              babyJub.F.eq(babyJub.F.e(point[0]), babyJub.F.e(encryptedPoint[0])) &&
              babyJub.F.eq(babyJub.F.e(point[1]), babyJub.F.e(encryptedPoint[1]))
            );
          });

          const decryptionWitness = await decryptionCircuit.calculateWitness({
            c1,
            c2,
            privateKey,
          });

          await decryptionCircuit.expectConstraintPass(decryptionWitness);

          const candidates = votes.map((vote) => babyJub.mulPointEscalar(babyJub.Base8, vote));

          const out = await getSignalArray(decryptionCircuit, decryptionWitness, "out", VOTE_OPTIONS, 2);

          return (
            isValidC1 &&
            isValidC2 &&
            out.every(
              ([x, y], index) =>
                babyJub.F.eq(candidates[index][0], babyJub.F.e(x)) &&
                babyJub.F.eq(candidates[index][1], babyJub.F.e(y)),
            )
          );
        },
      ),
    );
  }, 60_000);

  test("should fail if trying to encrypt votes with invalid parameters", async () => {
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
        async (votes: bigint[], random: bigint[], privateKey: bigint) => {
          const publicKey = [privateKey, privateKey];

          return encryptionCircuit
            .calculateWitness({
              votes,
              random,
              publicKey,
            })
            .then(() => false)
            .catch(() => true);
        },
      ),
    );
  }, 30_000);

  test("should fail if trying to decrypt votes with invalid parameters", async () => {
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
        async (votes: bigint[], random: bigint[], privateKey: bigint) => {
          const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, privateKey);

          const publicKey = [babyJub.F.toObject(publicKeyPoint[0]), babyJub.F.toObject(publicKeyPoint[1])];

          const encryptionWitness = await encryptionCircuit.calculateWitness({
            votes,
            random,
            publicKey,
          });

          const [c1, c2] = await Promise.all([
            getSignalArray(encryptionCircuit, encryptionWitness, "c1", VOTE_OPTIONS, 2),
            getSignalArray(encryptionCircuit, encryptionWitness, "c2", VOTE_OPTIONS, 2),
          ]);

          const decryptionWitness = await decryptionCircuit.calculateWitness({
            c1: c2.map(([x, y]) => [
              x + BigInt(Math.floor(Math.random() * 100) + 1),
              y + BigInt(Math.floor(Math.random() * 100) + 1),
            ]),
            c2: c1.map(([x, y]) => [
              x + BigInt(Math.floor(Math.random() * 100) + 1),
              y + BigInt(Math.floor(Math.random() * 100) + 1),
            ]),
            privateKey,
          });

          await decryptionCircuit.expectConstraintPass(decryptionWitness);

          const candidates = votes.map((vote) => babyJub.mulPointEscalar(babyJub.Base8, vote));

          const out = await getSignalArray(decryptionCircuit, decryptionWitness, "out", VOTE_OPTIONS, 2);

          return out.every(
            ([x, y], index) =>
              !babyJub.F.eq(candidates[index][0], babyJub.F.e(x)) &&
              !babyJub.F.eq(candidates[index][1], babyJub.F.e(y)),
          );
        },
      ),
    );
  }, 30_000);
});
