import { BabyJub, buildBabyjub, Point } from "circomlibjs";
import fc from "fast-check";
import { describe, test, beforeAll, expect } from "vitest";

import type { WitnessTester } from "circomkit";

import { circomkitInstance } from "./utils.js";

const LENGTH = 6;

describe("CalculateTotalPoints circuit", () => {
  let circuit: WitnessTester<["points"], ["out"]>;
  let babyJub: BabyJub;

  beforeAll(async () => {
    circuit = await circomkitInstance.WitnessTester("CalculateTotalPoints", {
      file: "./utils/CalculateTotalPoints",
      template: "CalculateTotalPoints",
      params: [LENGTH],
    });

    babyJub = await buildBabyjub();
  });

  test("should correctly sum a list of points", async () => {
    const points: Point[] = [];
    let result: Point = babyJub.mulPointEscalar(babyJub.Base8, 0);

    for (let index = 0; index < LENGTH; index += 1) {
      const point = babyJub.mulPointEscalar(babyJub.Base8, index);
      points.push(point);
      result = babyJub.addPoint(result, point);
    }

    const circuitInputs = {
      points: points.map(([x, y]) => [
        babyJub.F.toObject(x),
        babyJub.F.toObject(y),
      ]),
    };

    await circuit.expectPass(circuitInputs, {
      out: [babyJub.F.toObject(result[0]), babyJub.F.toObject(result[1])],
    });
  });

  test("should correctly sum exactly two points", async () => {
    const testCircuit = await circomkitInstance.WitnessTester(
      "CalculateTotalPoints",
      {
        file: "./utils/CalculateTotalPoints",
        template: "CalculateTotalPoints",
        params: [2],
      },
    );

    const point1 = babyJub.mulPointEscalar(babyJub.Base8, 3n);
    const point2 = babyJub.mulPointEscalar(babyJub.Base8, 7n);
    const expected = babyJub.addPoint(point1, point2);

    const points = [point1, point2].map(([x, y]) => [
      babyJub.F.toObject(x),
      babyJub.F.toObject(y),
    ]);

    await testCircuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(expected[0]), babyJub.F.toObject(expected[1])],
      },
    );
  });

  test("should correctly handle the identity point", async () => {
    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);
    const expected = babyJub.mulPointEscalar(babyJub.Base8, 123n);

    const points = [identity, expected].map(([x, y]) => [
      babyJub.F.toObject(x),
      babyJub.F.toObject(y),
    ]);

    const testCircuit = await circomkitInstance.WitnessTester(
      "CalculateTotalPoints",
      {
        file: "./utils/CalculateTotalPoints",
        template: "CalculateTotalPoints",
        params: [2],
      },
    );

    await testCircuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(expected[0]), babyJub.F.toObject(expected[1])],
      },
    );
  });

  test("should correctly sum only identity points", async () => {
    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);

    const points = Array.from({ length: LENGTH }, () => [
      babyJub.F.toObject(identity[0]),
      babyJub.F.toObject(identity[1]),
    ]);

    await circuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      },
    );
  });

  test("should correctly sum repeated points", async () => {
    const point = babyJub.mulPointEscalar(babyJub.Base8, 42n);
    let expected = babyJub.mulPointEscalar(babyJub.Base8, 0n);

    for (let index = 0; index < LENGTH; index += 1) {
      expected = babyJub.addPoint(expected, point);
    }

    const points = Array.from({ length: LENGTH }, () => [
      babyJub.F.toObject(point[0]),
      babyJub.F.toObject(point[1]),
    ]);

    await circuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(expected[0]), babyJub.F.toObject(expected[1])],
      },
    );
  });

  test("should correctly add inverse points", async () => {
    const point = babyJub.mulPointEscalar(babyJub.Base8, 123n);
    const inverse: Point = [babyJub.F.neg(point[0]), point[1]];
    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);

    const points = [point, inverse].map(([x, y]) => [
      babyJub.F.toObject(x),
      babyJub.F.toObject(y),
    ]);

    const testCircuit = await circomkitInstance.WitnessTester(
      "CalculateTotalPoints",
      {
        file: "./utils/CalculateTotalPoints",
        template: "CalculateTotalPoints",
        params: [2],
      },
    );

    await testCircuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      },
    );
  });

  test("should handle field coordinate wrapping", async () => {
    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);

    const points = [
      [babyJub.p, babyJub.p + 1n],
      [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
    ];

    await circuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      },
    );
  });

  test("should handle negative field coordinates", async () => {
    const testCircuit = await circomkitInstance.WitnessTester(
      "CalculateTotalPoints",
      {
        file: "./utils/CalculateTotalPoints",
        template: "CalculateTotalPoints",
        params: [2],
      },
    );

    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);

    const points = [
      [-babyJub.p, 1n - babyJub.p],
      [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
    ];

    await testCircuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(identity[0]), babyJub.F.toObject(identity[1])],
      },
    );
  });

  test("should handle maximum field values that wrap to a valid point", async () => {
    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);
    const point = babyJub.mulPointEscalar(babyJub.Base8, 123n);

    const x = babyJub.F.toObject(point[0]);
    const y = babyJub.F.toObject(point[1]);

    const wrappedPoint = [x + babyJub.p, y + babyJub.p];

    const points = [
      wrappedPoint,
      ...[identity, identity, identity, identity].map(([x, y]) => [
        babyJub.F.toObject(x),
        babyJub.F.toObject(y),
      ]),
      [
        babyJub.F.toObject(babyJub.mulPointEscalar(babyJub.Base8, 456n)[0]),
        babyJub.F.toObject(babyJub.mulPointEscalar(babyJub.Base8, 456n)[1]),
      ],
    ];

    const expected = babyJub.addPoint(
      point,
      babyJub.mulPointEscalar(babyJub.Base8, 456n),
    );

    await circuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(expected[0]), babyJub.F.toObject(expected[1])],
      },
    );
  });

  test("should treat equivalent field representations as the same point", async () => {
    const identity = babyJub.mulPointEscalar(babyJub.Base8, 0n);
    const point1 = babyJub.mulPointEscalar(babyJub.Base8, 123n);
    const point2 = babyJub.mulPointEscalar(babyJub.Base8, 456n);

    const x1 = babyJub.F.toObject(point1[0]);
    const y1 = babyJub.F.toObject(point1[1]);

    const points = [
      [x1 - babyJub.p, y1 - babyJub.p],
      [babyJub.F.toObject(point2[0]), babyJub.F.toObject(point2[1])],
      ...[identity, identity, identity, identity].map(([x, y]) => [
        babyJub.F.toObject(x),
        babyJub.F.toObject(y),
      ]),
    ];

    const expected = babyJub.addPoint(point1, point2);

    await circuit.expectPass(
      { points },
      {
        out: [babyJub.F.toObject(expected[0]), babyJub.F.toObject(expected[1])],
      },
    );
  });

  test("should correctly sum a list of points [fuzz]", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.bigInt({ min: 0n, max: babyJub.p - 1n }), { minLength: 2 }),
        async (scalars: bigint[]) => {
          const points = scalars
            .map((scalar) => babyJub.mulPointEscalar(babyJub.Base8, scalar))
            .map(([x, y]) => [babyJub.F.toObject(x), babyJub.F.toObject(y)]);

          const testCircuit = await circomkitInstance.WitnessTester(
            "CalculateTotalPoints",
            {
              file: "./utils/CalculateTotalPoints",
              template: "CalculateTotalPoints",
              params: [scalars.length],
            },
          );

          const witness = await testCircuit.calculateWitness({ points });

          return await testCircuit
            .expectConstraintPass(witness)
            .then(() => true)
            .catch(() => false);
        },
      ),
      { numRuns: 100 },
    );
  }, 60_000);

  test("should fail if length is less than two", async () => {
    const result1 = await circomkitInstance
      .WitnessTester("CalculateTotalPoints", {
        file: "./utils/CalculateTotalPoints",
        template: "CalculateTotalPoints",
        params: [0],
      })
      .then(() => false)
      .catch(() => true);

    const result2 = await circomkitInstance
      .WitnessTester("CalculateTotalPoints", {
        file: "./utils/CalculateTotalPoints",
        template: "CalculateTotalPoints",
        params: [1],
      })
      .then(() => false)
      .catch(() => true);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });

  test("should fail if points are not in curve", async () => {
    const points: bigint[][] = [];

    for (let index = 0; index < LENGTH; index += 1) {
      points.push([BigInt(index), BigInt(index)]);
    }

    await circuit.expectFail({ points });
  });
});
