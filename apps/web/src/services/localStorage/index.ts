const OPS_JWT_KEY = "maci.operator.jwt";

/** Browser persistence for the Operator JWT. */
export class LocalStorage {
  readonly #jwtKey = OPS_JWT_KEY;

  readStoredJwt(): string | undefined {
    const token = localStorage.getItem(this.#jwtKey);

    return token === null || token.length === 0 ? undefined : token;
  }

  storeJwt(token: string): void {
    localStorage.setItem(this.#jwtKey, token);
  }

  clearStoredJwt(): void {
    localStorage.removeItem(this.#jwtKey);
  }
}

export const storage = new LocalStorage();
