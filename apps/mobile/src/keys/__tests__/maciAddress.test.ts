import { configuredMaciAddress, formatMaciAddressPreview, readConfiguredMaciAddress } from "../maciAddress";

const CANONICAL = "0x0000000000000000000000000000000000000000000000001234567890abcdef";

describe("configured MACI address", () => {
  it("reads a build-time address as a canonical Starknet address", () => {
    expect(readConfiguredMaciAddress("0x1234567890abcdef")).toBe(CANONICAL);
    expect(readConfiguredMaciAddress("  0x1234567890ABCDEF  ")).toBe(CANONICAL);
  });

  it("treats an empty or invalid address as unconfigured", () => {
    expect(readConfiguredMaciAddress(undefined)).toBeNull();
    expect(readConfiguredMaciAddress("")).toBeNull();
    expect(readConfiguredMaciAddress("   ")).toBeNull();
    expect(readConfiguredMaciAddress("1234567890abcdef")).toBeNull();
    expect(readConfiguredMaciAddress("0x")).toBeNull();
    expect(readConfiguredMaciAddress("0x1234567890abcdefg")).toBeNull();
    expect(readConfiguredMaciAddress(`0x${"f".repeat(65)}`)).toBeNull();
    expect(readConfiguredMaciAddress("0x0")).toBeNull();
    expect(readConfiguredMaciAddress(`0x08${"0".repeat(62)}`)).toBeNull();
  });

  it("shows a truncated address", () => {
    expect(formatMaciAddressPreview(CANONICAL)).toBe("0x0000…cdef");
  });

  it("reads EXPO_PUBLIC_MACI_ADDRESS", () => {
    const env: unknown = process.env.EXPO_PUBLIC_MACI_ADDRESS;
    const previous = typeof env === "string" ? env : undefined;
    process.env.EXPO_PUBLIC_MACI_ADDRESS = "0x1234567890abcdef";

    try {
      expect(configuredMaciAddress()).toBe(CANONICAL);
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_PUBLIC_MACI_ADDRESS;
      } else {
        process.env.EXPO_PUBLIC_MACI_ADDRESS = previous;
      }
    }
  });
});
