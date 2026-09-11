import { object, strictObject, string, type infer as ZodInfer } from "zod";

const errorBodySchema = object({ error: string() });
const nonceResponseSchema = strictObject({ nonce: string().min(1) });
const operatorSessionSchema = strictObject({
  token: string().min(1),
  address: string().min(1),
});
const sessionAddressSchema = strictObject({ address: string().min(1) });

export type OperatorSession = ZodInfer<typeof operatorSessionSchema>;

function readError(body: unknown, fallback: string): string {
  const parsed = errorBodySchema.safeParse(body);

  return parsed.success ? parsed.data.error : fallback;
}

/** HTTP client for the ops Operator login API. */
export class OpsClient {
  readonly #root: string;

  constructor(baseUrl: string) {
    this.#root = baseUrl.replace(/\/$/u, "");
  }

  async issueNonce(): Promise<string> {
    const res = await fetch(`${this.#root}/nonce`, { method: "POST", cache: "no-store" });
    const body: unknown = await res.json();
    const parsed = nonceResponseSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "nonce failed"));
    }

    return parsed.data.nonce;
  }

  async login(nonce: string, signature: string): Promise<OperatorSession> {
    const res = await fetch(`${this.#root}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nonce, signature }),
    });
    const body: unknown = await res.json();
    const parsed = operatorSessionSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "login failed"));
    }

    return parsed.data;
  }

  async readSession(token: string): Promise<string> {
    const res = await fetch(`${this.#root}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body: unknown = await res.json();
    const parsed = sessionAddressSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "session failed"));
    }

    return parsed.data.address;
  }
}
