import { BabyJub, buildBabyjub } from "circomlibjs";
import fc from "fast-check";
import { describe, test, beforeAll } from "vitest";

import type { WitnessTester } from "circomkit";

import { circomkitInstance, getSignal } from "./utils.js";

describe("CalculateTotal circuit", () => {
  let circuit: WitnessTester<["nums"], ["sum"]>;
  let babyJub: BabyJub;

  beforeAll(async () => {
    circuit = await circomkitInstance.WitnessTester("calculateTotal", {
      file: "./utils/CalculateTotal",
      template: "CalculateTotal",
      params: [6],
    });

    babyJub = await buildBabyjub();
  });

  test("should correctly sum a list of values", async () => {
    const nums: number[] = [];

    for (let index = 0; index < 6; index += 1) {
      nums.push(Math.floor(Math.random() * 100));
    }

    const sum = nums.reduce((a, b) => a + b, 0);

    const circuitInputs = {
      nums,
    };

    await circuit.expectPass(circuitInputs, { sum });
  });

  test("should sum max value and loop back", async () => {
    const nums: bigint[] = [
      babyJub.p,
      babyJub.p,
      babyJub.p,
      babyJub.p,
      babyJub.p,
      babyJub.p,
    ];

    await circuit.expectPass({ nums }, { sum: 0n });
  });

  test("should sum max negative value and loop back", async () => {
    const nums: bigint[] = [
      -babyJub.p,
      -babyJub.p,
      -babyJub.p,
      -babyJub.p,
      -babyJub.p,
      -babyJub.p,
    ];

    await circuit.expectPass({ nums }, { sum: 0n });
  });

  test("should sum max positive and negative values without looping", async () => {
    const nums: bigint[] = [
      -babyJub.p,
      babyJub.p,
      -babyJub.p,
      babyJub.p,
      1n,
      2n,
    ];

    await circuit.expectPass({ nums }, { sum: 3n });
  });

  test("should correctly sum a list of values [fuzz]", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.bigInt({ min: 0n, max: babyJub.p - 1n }), {
          minLength: 1,
        }),
        async (nums: bigint[]) => {
          const sum = nums.reduce((a, b) => a + b, 0n);
          fc.pre(sum <= babyJub.p - 1n);

          const testCircuit = await circomkitInstance.WitnessTester(
            "calculateTotal",
            {
              file: "./utils/CalculateTotal",
              template: "CalculateTotal",
              params: [nums.length],
            },
          );

          const witness = await testCircuit.calculateWitness({ nums });
          await testCircuit.expectConstraintPass(witness);
          const total = await getSignal(testCircuit, witness, "sum");

          return total === sum;
        },
      ),
      { numRuns: 1000 },
    );
  }, 60_000);
});
