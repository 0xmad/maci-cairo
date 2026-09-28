import { formatUserPublicKeyPreview, serializeUserPublicKey } from "../serializeUserPublicKey";
import { BASE8_TIMES_7, PACKED_BASE8_TIMES_7_HEX } from "../testFixtures";

describe("serializeUserPublicKey", () => {
  it("serializes coordinates as macipk. packed hex", () => {
    expect(serializeUserPublicKey({ x: "0", y: "1" })).toBe("macipk.01");
    expect(serializeUserPublicKey(BASE8_TIMES_7)).toBe(`macipk.${PACKED_BASE8_TIMES_7_HEX}`);
  });
});

describe("formatUserPublicKeyPreview", () => {
  it("truncates the MACI-serialized user public key", () => {
    expect(formatUserPublicKeyPreview({ x: "0", y: "1" })).toBe("macipk.01");
    expect(formatUserPublicKeyPreview(BASE8_TIMES_7)).toBe("macipk…0f21");
  });
});
