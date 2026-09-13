import { describe, expect, it } from "vitest";

import { truncateAddress } from "../truncateAddress";

describe("truncateAddress", () => {
  it("keeps short addresses intact", () => {
    expect(truncateAddress("0xabc")).toBe("0xabc");
  });

  it("shows the first six and last four characters of a felt", () => {
    expect(truncateAddress("0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691")).toBe("0x064b…5691");
  });
});
