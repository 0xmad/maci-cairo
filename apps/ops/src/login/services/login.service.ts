import type { NonceRepository } from "../repositories/nonce.repository.js";

import { normalizeHex } from "../utils/allowlist.js";

import { type SessionService } from "./session.service.js";
import { type WalletVerifier } from "./wallet.service.js";

export interface LoginServiceDeps {
  nonceRepository: NonceRepository;
  sessionService: SessionService;
  walletService: WalletVerifier;
  allowlist: readonly string[];
  nowMs: () => number;
  randomNonce: () => string;
}

export interface OperatorSession {
  token: string;
  address: string;
}

/**
 * Operator login: one-time nonce, wallet signature, allowlist, hours-TTL session token.
 * `authenticate` re-checks the allowlist so a restart with a smaller list revokes.
 */
export class LoginService {
  readonly #deps: LoginServiceDeps;

  readonly #listed: Set<string>;

  constructor(deps: LoginServiceDeps) {
    this.#deps = deps;
    this.#listed = new Set(deps.allowlist.map((address) => normalizeHex(address)));
  }

  async issueNonce(): Promise<string> {
    const nonce = this.#deps.randomNonce();
    await this.#deps.nonceRepository.save(nonce, this.#deps.nowMs());

    return nonce;
  }

  async login(nonce: string, signature: string): Promise<OperatorSession> {
    const consumed = await this.#deps.nonceRepository.consume(nonce);

    if (!consumed) {
      throw new Error("invalid nonce");
    }

    const address = normalizeHex(await this.#deps.walletService.verify(nonce, signature));

    if (!this.#listed.has(address)) {
      throw new Error("not allowlisted");
    }

    return {
      token: await this.#deps.sessionService.issue(address, this.#deps.nowMs()),
      address,
    };
  }

  async authenticate(token: string): Promise<string> {
    const address = normalizeHex(await this.#deps.sessionService.read(token, this.#deps.nowMs()));

    if (!this.#listed.has(address)) {
      throw new Error("not allowlisted");
    }

    return address;
  }
}
