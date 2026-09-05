import { buildBabyjub } from "circomlibjs";
import { beforeAll, describe, test } from "vitest";

import type { WitnessTester } from "circomkit";

import { circomkitInstance } from "./utils/index.js";

describe("LessThanField", () => {
  let circuit: WitnessTester<["in"], ["out"]>;
  let field: bigint;

  beforeAll(async () => {
    const [tester, babyJub] = await Promise.all([
      circomkitInstance.WitnessTester("LessThanField", {
        file: "./utils/LessThanField",
        template: "LessThanField",
      }),
      buildBabyjub(),
    ]);

    circuit = tester;
    field = babyJub.p;
  });

  test("should be true when the first value is smaller", async () => {
    await circuit.expectPass({ in: [0n, 1n] }, { out: 1n });
    await circuit.expectPass({ in: [1n, 2n ** 253n] }, { out: 1n });
    await circuit.expectPass({ in: [0n, field - 1n] }, { out: 1n });
  });

  test("should be false when the values are equal", async () => {
    await circuit.expectPass({ in: [0n, 0n] }, { out: 0n });
    await circuit.expectPass({ in: [field - 1n, field - 1n] }, { out: 0n });
  });

  test("should be false when the first value is larger", async () => {
    await circuit.expectPass({ in: [1n, 0n] }, { out: 0n });
    await circuit.expectPass({ in: [2n ** 253n, 2n ** 252n] }, { out: 0n });
    await circuit.expectPass({ in: [field - 1n, 0n] }, { out: 0n });
  });

  test("should compare using the most significant bit", async () => {
    const withMsb = 2n ** 253n;
    const withoutMsb = 2n ** 253n - 1n;

    await circuit.expectPass({ in: [withoutMsb, withMsb] }, { out: 1n });
    await circuit.expectPass({ in: [withMsb, withoutMsb] }, { out: 0n });
  });
});
