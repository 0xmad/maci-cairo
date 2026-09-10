/** Persists one-time Operator login nonces. */
export interface NonceRepository {
  save: (nonce: string, issuedAtMs: number) => Promise<void>;
  consume: (nonce: string) => Promise<boolean>;
}
