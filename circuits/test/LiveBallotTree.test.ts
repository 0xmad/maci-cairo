import { describe, expect, test } from "vitest";

import { LiveBallotTree, liveBallotValue } from "../ts/liveBallotTree.js";

describe("LiveBallotTree", () => {
  test("should reject a live-ballot value with mismatched ciphertext lengths", () => {
    expect(() => liveBallotValue([[1n, 2n]], [])).toThrow("encrypted Votes C1 and C2 must have the same length");
  });

  test("should reject a live-ballot value with no vote options", () => {
    expect(() => liveBallotValue([], [])).toThrow("live-ballot value requires at least one vote option");
  });

  test("should reject inserting when the tree is full", () => {
    const tree = new LiveBallotTree(2);

    tree.insert(1n, 10n);
    tree.insert(2n, 20n);
    tree.insert(3n, 30n);

    expect(() => tree.insert(4n, 40n)).toThrow("live-ballot tree is full");
  });

  test("should reject updating a user commitment that is not in the tree", () => {
    const tree = new LiveBallotTree(4);

    expect(() => tree.update(7n, 1n)).toThrow("user commitment is not in the live-ballot tree");
  });

  test("should reject inserting when no predecessor gap contains the key", () => {
    const tree = new LiveBallotTree(4);
    tree.insert(5n, 1n);

    expect(() => tree.insert(5n, 2n)).toThrow("no predecessor gap for user commitment");
  });
});
