import { SseReader, type SseFrame } from "../sse";

import {
  errorBodySchema,
  jobEventSchema,
  jobResponseSchema,
  maciInstanceSchema,
  maciListResponseSchema,
  nonceResponseSchema,
  operatorSessionSchema,
  sessionAddressSchema,
  startStandUpSchema,
  type JobEvent,
  type JobSnapshot,
  type MaciInstance,
  type MaciListPage,
  type OperatorSession,
} from "./schema";

export type {
  JobEvent,
  JobSnapshot,
  JobStep,
  MaciInstance,
  MaciListItem,
  MaciListPage,
  OperatorSession,
  Paginated,
} from "./schema";

function readError(body: unknown, fallback: string): string {
  const parsed = errorBodySchema.safeParse(body);

  return parsed.success ? parsed.data.error : fallback;
}

function authHeaders(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function parseJobEvent(frame: SseFrame): JobEvent | undefined {
  if (frame.data === undefined) {
    return undefined;
  }

  try {
    const event = jobEventSchema.safeParse(JSON.parse(frame.data) as unknown);

    return event.success ? event.data : undefined;
  } catch {
    return undefined;
  }
}

/** HTTP client for the ops Operator login and MACI stand-up job API. */
export class OpsClient {
  readonly #root: string;

  readonly #jobEvents = new SseReader(parseJobEvent);

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
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = sessionAddressSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "session failed"));
    }

    return parsed.data.address;
  }

  async startStandUp(token: string): Promise<string> {
    const res = await fetch(`${this.#root}/standup`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = startStandUpSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "stand-up failed"));
    }

    return parsed.data.jobId;
  }

  async readJob(token: string): Promise<JobSnapshot | undefined> {
    const res = await fetch(`${this.#root}/job`, {
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = jobResponseSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "job failed"));
    }

    return parsed.data.job ?? undefined;
  }

  async listMacis(token: string, page: number, pageSize: number): Promise<MaciListPage> {
    const res = await fetch(`${this.#root}/macis?page=${String(page)}&pageSize=${String(pageSize)}`, {
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = maciListResponseSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "MACI list failed"));
    }

    return parsed.data;
  }

  async readMaci(token: string, address: string): Promise<MaciInstance> {
    const res = await fetch(`${this.#root}/macis/${encodeURIComponent(address)}`, {
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = maciInstanceSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "MACI instance failed"));
    }

    return parsed.data;
  }

  async subscribeJobEvents(token: string, onEvent: (event: JobEvent) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${this.#root}/job/events`, {
      headers: authHeaders(token),
      signal,
    });

    if (!res.ok) {
      let body: unknown;

      try {
        body = await res.json();
      } catch {
        body = undefined;
      }

      throw new Error(readError(body, "subscribe failed"));
    }

    if (res.body === null) {
      throw new Error("subscribe failed");
    }

    await this.#jobEvents.read(res.body, onEvent, signal);
  }
}
