import { afterEach, describe, expect, it } from "vitest";

import { LocalStorage } from "..";

const OPS_JWT_KEY = "maci.operator.jwt";
const storage = new LocalStorage();

afterEach(() => {
  localStorage.removeItem(OPS_JWT_KEY);
});

describe("operator JWT storage", () => {
  it("returns undefined when no token is stored", () => {
    expect(storage.readStoredJwt()).toBeUndefined();
  });

  it("round-trips a stored token", () => {
    storage.storeJwt("jwt");

    expect(localStorage.getItem(OPS_JWT_KEY)).toBe("jwt");
    expect(storage.readStoredJwt()).toBe("jwt");
  });

  it("treats an empty stored value as missing", () => {
    localStorage.setItem(OPS_JWT_KEY, "");

    expect(storage.readStoredJwt()).toBeUndefined();
  });

  it("clears the stored token", () => {
    storage.storeJwt("jwt");
    storage.clearStoredJwt();

    expect(localStorage.getItem(OPS_JWT_KEY)).toBeNull();
    expect(storage.readStoredJwt()).toBeUndefined();
  });
});
