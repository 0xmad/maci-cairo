import { describe, expect, it } from "vitest";

import { createOperatorSessionStore } from "../operatorSession.js";

function memoryPersistence(initial?: string): {
  readStoredJwt: () => string | undefined;
  storeJwt: (token: string) => void;
  clearStoredJwt: () => void;
} {
  let token = initial;

  return {
    readStoredJwt: (): string | undefined => token,
    storeJwt: (next: string): void => {
      token = next;
    },
    clearStoredJwt: (): void => {
      token = undefined;
    },
  };
}

describe("operator session store", () => {
  it("hydrates the token from persistence", () => {
    const persistence = memoryPersistence("jwt");
    const store = createOperatorSessionStore(persistence);

    expect(store.getState().token).toBe("jwt");
  });

  it("persists setToken and notifies subscribers", () => {
    const persistence = memoryPersistence();
    const store = createOperatorSessionStore(persistence);
    let seen: string | undefined;
    const unsubscribe = store.subscribe((state) => {
      seen = state.token;
    });

    store.getState().setToken("jwt");
    unsubscribe();

    expect(persistence.readStoredJwt()).toBe("jwt");
    expect(store.getState().token).toBe("jwt");
    expect(seen).toBe("jwt");
  });

  it("clears the persisted token", () => {
    const persistence = memoryPersistence("jwt");
    const store = createOperatorSessionStore(persistence);

    store.getState().clearToken();

    expect(persistence.readStoredJwt()).toBeUndefined();
    expect(store.getState().token).toBeUndefined();
  });
});
