import { subOrder } from "@zk-kit/baby-jubjub";
import { getRandomBytes } from "expo-crypto";

import { babyJubUserKeyCrypto } from "../babyJubUserKeyCrypto";
import { BASE8_TIMES_7, bigintToBytes32 } from "../testFixtures";

jest.mock("expo-crypto", () => ({
  getRandomBytes: jest.fn(),
}));

const getRandomBytesMock = jest.mocked(getRandomBytes);

describe("babyJubUserKeyCrypto", () => {
  beforeEach(() => {
    getRandomBytesMock.mockReset();
  });

  it("derives the user public key as Base8 times the private key", () => {
    expect(babyJubUserKeyCrypto.publicKeyFromPrivate("7")).toEqual(BASE8_TIMES_7);
  });

  it("generates a private key from 32 random bytes reduced mod subOrder", () => {
    getRandomBytesMock.mockReturnValue(bigintToBytes32(7n));

    expect(babyJubUserKeyCrypto.generatePrivateKey()).toBe("7");
    expect(getRandomBytesMock).toHaveBeenCalledWith(32);
  });

  it("uses 1 when random bytes reduce to 0", () => {
    getRandomBytesMock.mockReturnValue(bigintToBytes32(0n));

    expect(babyJubUserKeyCrypto.generatePrivateKey()).toBe("1");
  });

  it("reduces values at or above subOrder", () => {
    getRandomBytesMock.mockReturnValue(bigintToBytes32(subOrder + 7n));

    expect(babyJubUserKeyCrypto.generatePrivateKey()).toBe("7");
  });
});
