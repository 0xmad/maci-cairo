import { buildBabyjub } from "circomlibjs";
import fc from "fast-check";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { circomkitInstance, getSignal } from "./utils/index.js";

describe("PrivateToPublicKey", () => {
  let circuit: WitnessTester<["privateKey"], ["publicKey"]>;
  let babyJub: Awaited<ReturnType<typeof buildBabyjub>>;

  beforeAll(async () => {
    [circuit, babyJub] = await Promise.all([
      circomkitInstance.WitnessTester("privateToPublicKey", {
        file: "./utils/PrivateToPublicKey",
        template: "PrivateToPublicKey",
      }),
      buildBabyjub(),
    ]);
  });

  test("should correctly compute a public key", async () => {
    await fc.assert(
      fc.asyncProperty(fc.bigInt({ min: 0n, max: babyJub.subOrder - 1n }), async (privateKey: bigint) => {
        const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8, privateKey);

        const witness = await circuit.calculateWitness({ privateKey });
        await circuit.expectConstraintPass(witness);

        const [x, y] = await Promise.all([
          getSignal(circuit, witness, "publicKey[0]"),
          getSignal(circuit, witness, "publicKey[1]"),
        ]);

        return (
          babyJub.inCurve([babyJub.F.e(x), babyJub.F.e(y)]) &&
          babyJub.F.eq(publicKeyPoint[0], babyJub.F.e(x)) &&
          babyJub.F.eq(publicKeyPoint[1], babyJub.F.e(y))
        );
      }),
    );
  });

  test("should throw error if private key is not in the prime subgroup l", async () => {
    await fc.assert(
      fc.asyncProperty(fc.bigInt({ min: babyJub.subOrder, max: babyJub.p - 1n }), async (privateKey: bigint) =>
        circuit
          .expectFail({ privateKey })
          .then(() => true)
          .catch(() => false),
      ),
    );
  });
});
