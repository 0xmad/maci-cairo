import { SseReader, type SseFrame } from "../sse";

import {
  errorBodySchema,
  jobEventSchema,
  jobResponseSchema,
  maciInstanceSchema,
  maciListResponseSchema,
  nonceResponseSchema,
  operatorSessionSchema,
  pollListResponseSchema,
  sessionAddressSchema,
  startJobSchema,
  standUpCatalogSchema,
  type CreatePollBody,
  type JobEvent,
  type JobSnapshot,
  type MaciInstance,
  type MaciListPage,
  type OperatorSession,
  type PollListPage,
  type StandUpBody,
  type StandUpCatalog,
} from "./schema";

export type {
  JobEvent,
  CreatePollBody,
  CreatePollIntent,
  JobSnapshot,
  JobStep,
  MaciInstance,
  MaciListItem,
  MaciListPage,
  OperatorSession,
  Paginated,
  PollListItem,
  PollListPage,
  StandUpBody,
  StandUpCatalog,
  StandUpIntent,
} from "./schema";

export {
  DEFAULT_CONSTANT_VOTE_BALANCE,
  SMALL_STAND_UP_BODY,
  createPollIntentSchema,
  standUpIntentSchema,
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

  async readStandUpCatalog(token: string): Promise<StandUpCatalog> {
    const res = await fetch(`${this.#root}/standup`, {
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = standUpCatalogSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "catalog failed"));
    }

    return parsed.data;
  }

  async startStandUp(token: string, intent: StandUpBody): Promise<string> {
    const res = await fetch(`${this.#root}/standup`, {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(intent),
    });
    const body: unknown = await res.json();
    const parsed = startJobSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "stand-up failed"));
    }

    return parsed.data.jobId;
  }

  async startCreatePoll(token: string, maci: string, intent: CreatePollBody): Promise<string> {
    const res = await fetch(`${this.#root}/macis/${encodeURIComponent(maci)}/poll`, {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(intent),
    });
    const body: unknown = await res.json();
    const parsed = startJobSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "Create Poll failed"));
    }

    return parsed.data.jobId;
  }

  async readJobState(
    token: string,
  ): Promise<{ job?: JobSnapshot; incompleteStandUp: boolean; currentMaci: string | null }> {
    const res = await fetch(`${this.#root}/job`, {
      headers: authHeaders(token),
    });
    const body: unknown = await res.json();
    const parsed = jobResponseSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "job failed"));
    }

    return {
      job: parsed.data.job ?? undefined,
      incompleteStandUp: parsed.data.incompleteStandUp,
      currentMaci: parsed.data.currentMaci,
    };
  }

  async discardStandUp(token: string): Promise<void> {
    const res = await fetch(`${this.#root}/standup/discard`, {
      method: "POST",
      headers: authHeaders(token),
    });

    if (!res.ok) {
      const body: unknown = await res.json().catch(() => undefined);

      throw new Error(readError(body, "discard failed"));
    }
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

  async listPolls(token: string, maci: string, page: number, pageSize: number): Promise<PollListPage> {
    const res = await fetch(
      `${this.#root}/macis/${encodeURIComponent(maci)}/polls?page=${String(page)}&pageSize=${String(pageSize)}`,
      {
        headers: authHeaders(token),
      },
    );
    const body: unknown = await res.json();
    const parsed = pollListResponseSchema.safeParse(body);

    if (!res.ok || !parsed.success) {
      throw new Error(readError(body, "Poll list failed"));
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
