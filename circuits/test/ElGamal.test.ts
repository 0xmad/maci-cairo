import { buildBabyjub } from "circomlibjs";
import fc from "fast-check";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { circomkitInstance, getSignal } from "./utils.js";

describe("ElGamalEncryption", () => {
  let encryptionCircuit: WitnessTester<["random", "message", "publicKey"], ["c1", "c2"]>;
  let decryptionCircuit: WitnessTester<["privateKey", "c1", "c2"], ["out"]>;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    encryptionCircuit = await circomkitInstance.WitnessTester("ElGamalEncryption", {
      file: "elgamal/ElGamalEncryption",
      template: "ElGamalEncryption",
      params: [],
    });

    decryptionCircuit = await circomkitInstance.WitnessTester("ElGamalDecryption", {
      file: "elgamal/ElGamalDecryption",
      template: "ElGamalDecryption",
      params: [],
    });

    babyJub = await buildBabyjub();
  });

  test("should encrypt and decrypt one vote correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: 1000n }),
        async (privateKey: bigint, random: bigint, message: bigint) => {
          const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, privateKey);

          const publicKey = [babyJub.F.toObject(publicKeyPoint[0]), babyJub.F.toObject(publicKeyPoint[1])];

          const encryptionWitness = await encryptionCircuit.calculateWitness({
            random,
            message,
            publicKey,
          });

          await encryptionCircuit.expectConstraintPass(encryptionWitness);

          const [c1x, c1y, c2x, c2y] = await Promise.all([
            getSignal(encryptionCircuit, encryptionWitness, "c1[0]"),
            getSignal(encryptionCircuit, encryptionWitness, "c1[1]"),
            getSignal(encryptionCircuit, encryptionWitness, "c2[0]"),
            getSignal(encryptionCircuit, encryptionWitness, "c2[1]"),
          ]);

          const decryptionWitness = await decryptionCircuit.calculateWitness({
            c1: [c1x, c1y],
            c2: [c2x, c2y],
            privateKey,
          });

          await decryptionCircuit.expectConstraintPass(decryptionWitness);

          const [mx, my] = await Promise.all([
            getSignal(decryptionCircuit, decryptionWitness, "out[0]"),
            getSignal(decryptionCircuit, decryptionWitness, "out[1]"),
          ]);

          const candidate = babyJub.mulPointEscalar(babyJub.Base8, message);

          return babyJub.F.eq(candidate[0], babyJub.F.e(mx)) && babyJub.F.eq(candidate[1], babyJub.F.e(my));
        },
      ),
    );
  });

  test("should fail if trying to encrypt with invalid parameters", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: 1000n }),
        async (privateKey: bigint, random: bigint, message: bigint) => {
          const publicKey = [privateKey, privateKey];

          return encryptionCircuit
            .calculateWitness({
              random,
              message,
              publicKey,
            })
            .then(() => false)
            .catch(() => true);
        },
      ),
    );
  });

  test("should fail if trying to decrypt with invalid parameters", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: babyJub.subOrder - 1n }),
        fc.bigInt({ min: 1n, max: 1000n }),
        async (privateKey: bigint, random: bigint, message: bigint) => {
          const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, privateKey);

          const publicKey = [babyJub.F.toObject(publicKeyPoint[0]), babyJub.F.toObject(publicKeyPoint[1])];

          const encryptionWitness = await encryptionCircuit.calculateWitness({
            random,
            message,
            publicKey,
          });

          await encryptionCircuit.expectConstraintPass(encryptionWitness);

          const [c1x, c1y, c2x, c2y] = await Promise.all([
            getSignal(encryptionCircuit, encryptionWitness, "c1[0]"),
            getSignal(encryptionCircuit, encryptionWitness, "c1[1]"),
            getSignal(encryptionCircuit, encryptionWitness, "c2[0]"),
            getSignal(encryptionCircuit, encryptionWitness, "c2[1]"),
          ]);

          const decryptionWitness = await decryptionCircuit.calculateWitness({
            c1: [c2x, c1y],
            c2: [c1x, c2y],
            privateKey,
          });

          await decryptionCircuit.expectConstraintPass(decryptionWitness);

          const [mx, my] = await Promise.all([
            getSignal(decryptionCircuit, decryptionWitness, "out[0]"),
            getSignal(decryptionCircuit, decryptionWitness, "out[1]"),
          ]);

          const candidate = babyJub.mulPointEscalar(babyJub.Base8, message);

          return !babyJub.F.eq(candidate[0], babyJub.F.e(mx)) && !babyJub.F.eq(candidate[1], babyJub.F.e(my));
        },
      ),
    );
  });
});
