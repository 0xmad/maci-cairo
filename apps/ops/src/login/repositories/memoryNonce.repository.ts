import type { NonceRepository } from "./nonce.repository.js";

/** In-memory nonce repository for tests. */
export class MemoryNonceRepository implements NonceRepository {
  readonly #rows = new Map<string, number>();

  save(nonce: string, issuedAtMs: number): Promise<void> {
    this.#rows.set(nonce, issuedAtMs);

    return Promise.resolve();
  }

  consume(nonce: string): Promise<boolean> {
    const existed = this.#rows.has(nonce);
    this.#rows.delete(nonce);

    return Promise.resolve(existed);
  }
}
