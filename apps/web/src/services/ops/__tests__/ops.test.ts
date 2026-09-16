import { describe, expect, it, vi } from "vitest";

import { OpsClient } from "..";

describe("OpsClient", () => {
  it("posts nonce and login then reads /me", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      if (url.endsWith("/nonce")) {
        expect(init?.cache).toBe("no-store");

        return new Response(JSON.stringify({ nonce: "n1" }), { status: 200 });
      }

      if (url.endsWith("/login")) {
        expect(init?.body).toBe(JSON.stringify({ nonce: "n1", signature: "sig" }));

        return new Response(JSON.stringify({ token: "jwt", address: "0x1" }), { status: 200 });
      }

      expect(init?.headers).toEqual({ authorization: "Bearer jwt" });

      return new Response(JSON.stringify({ address: "0x1" }), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test/");

    await expect(client.issueNonce()).resolves.toBe("n1");
    await expect(client.login("n1", "sig")).resolves.toEqual({ token: "jwt", address: "0x1" });
    await expect(client.readSession("jwt")).resolves.toBe("0x1");

    vi.unstubAllGlobals();
  });

  it("reads the stand-up catalog with the Operator JWT", async () => {
    const catalog = {
      circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
      policies: [{ id: "Free for all" }],
      assigners: [{ id: "Constant vote balance" }],
    };
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      expect(url).toBe("http://ops.test/standup");
      expect(init?.method).toBeUndefined();
      expect(init?.headers).toEqual({ authorization: "Bearer jwt" });

      return new Response(JSON.stringify(catalog), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(client.readStandUpCatalog("jwt")).resolves.toEqual(catalog);

    vi.unstubAllGlobals();
  });

  it("throws the API error body when catalog read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readStandUpCatalog("jwt")).rejects.toThrow(/^unauthorized$/u);

    vi.unstubAllGlobals();
  });

  it("starts MACI stand-up with the Operator JWT and the small catalog body", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      expect(url).toBe("http://ops.test/standup");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        authorization: "Bearer jwt",
        "content-type": "application/json",
      });
      expect(init?.body).toBe(
        JSON.stringify({
          circuitProfile: "small",
          policy: "Free for all",
          assigner: "Constant vote balance",
          voteBalance: 3,
        }),
      );

      return new Response(JSON.stringify({ jobId: "job-1" }), { status: 201 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(
      client.startStandUp("jwt", {
        circuitProfile: "small",
        policy: "Free for all",
        assigner: "Constant vote balance",
        voteBalance: 3,
      }),
    ).resolves.toBe("job-1");

    vi.unstubAllGlobals();
  });

  it("starts Create Poll against the MACI in the path", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      expect(url).toBe("http://ops.test/macis/0x7/poll");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ startDate: 0, endDate: 1000, pollPublicKey: ["0", "1"] }));

      return new Response(JSON.stringify({ jobId: "job-2" }), { status: 201 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(
      client.startCreatePoll("jwt", "0x7", { startDate: 0, endDate: 1000, pollPublicKey: ["0", "1"] }),
    ).resolves.toBe("job-2");

    vi.unstubAllGlobals();
  });

  it("throws busy when a second stand-up is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "busy" }), { status: 409 })));

    const client = new OpsClient("http://ops.test");

    await expect(
      client.startStandUp("jwt", {
        circuitProfile: "small",
        policy: "Free for all",
        assigner: "Constant vote balance",
        voteBalance: 3,
      }),
    ).rejects.toThrow(/^busy$/u);

    vi.unstubAllGlobals();
  });

  it("throws busy when Create Poll is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "busy" }), { status: 409 })));

    const client = new OpsClient("http://ops.test");

    await expect(
      client.startCreatePoll("jwt", "0x7", { startDate: 0, endDate: 1000, pollPublicKey: ["0", "1"] }),
    ).rejects.toThrow(/^busy$/u);

    vi.unstubAllGlobals();
  });

  it("subscribes to job SSE with the JWT on the request", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(
          new TextEncoder().encode('event: completed\ndata: {"type":"completed","status":"succeeded"}\n\n'),
        );
        controller.close();
      },
    });
    const fetchMock = vi.fn(
      () =>
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");
    const events: unknown[] = [];
    await client.subscribeJobEvents("jwt", (event) => {
      events.push(event);
    });

    expect(fetchMock).toHaveBeenCalledWith("http://ops.test/job/events", {
      headers: { authorization: "Bearer jwt" },
      signal: undefined,
    });
    expect(events).toEqual([{ type: "completed", status: "succeeded" }]);

    vi.unstubAllGlobals();
  });

  it("throws the API error body when login fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid nonce" }), { status: 401 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.login("n1", "sig")).rejects.toThrow(/invalid nonce/u);

    vi.unstubAllGlobals();
  });

  it("throws the API error body when nonce issue fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "busy" }), { status: 429 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.issueNonce()).rejects.toThrow(/busy/u);

    vi.unstubAllGlobals();
  });

  it("throws nonce failed when the nonce body is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.issueNonce()).rejects.toThrow(/nonce failed/u);

    vi.unstubAllGlobals();
  });

  it("throws the API error body when session read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "expired" }), { status: 401 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readSession("jwt")).rejects.toThrow(/expired/u);

    vi.unstubAllGlobals();
  });

  it("lists MACI instances with page query params", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      expect(url).toBe("http://ops.test/macis?page=2&pageSize=10");
      expect(init?.headers).toEqual({ authorization: "Bearer jwt" });

      return new Response(
        JSON.stringify({
          items: [{ address: "0x7", network: "starknet_local", createdAtMs: 1_000_100 }],
          total: 11,
          page: 2,
          pageSize: 10,
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(client.listMacis("jwt", 2, 10)).resolves.toEqual({
      items: [{ address: "0x7", network: "starknet_local", createdAtMs: 1_000_100 }],
      total: 11,
      page: 2,
      pageSize: 10,
    });

    vi.unstubAllGlobals();
  });

  it("lists Polls for a MACI with page query params", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      expect(url).toBe("http://ops.test/macis/0x7/polls?page=1&pageSize=10");
      expect(init?.headers).toEqual({ authorization: "Bearer jwt" });

      return new Response(
        JSON.stringify({
          items: [
            {
              address: "0xaa",
              pollId: "2",
              startDate: "0",
              endDate: "1000",
              pollPublicKey: ["0", "1"],
              createdAtMs: 1_000_200,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(client.listPolls("jwt", "0x7", 1, 10)).resolves.toEqual({
      items: [
        {
          address: "0xaa",
          pollId: "2",
          startDate: "0",
          endDate: "1000",
          pollPublicKey: ["0", "1"],
          createdAtMs: 1_000_200,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    vi.unstubAllGlobals();
  });

  it("throws when the Poll list body is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.listPolls("jwt", "0x7", 1, 10)).rejects.toThrow(/^Poll list failed$/u);

    vi.unstubAllGlobals();
  });

  it("reads a MACI instance by address", async () => {
    const instance = {
      leanImt: "0x1",
      checker: "0x2",
      enforcer: "0x3",
      assigner: "0x4",
      pollClassHash: "0x5",
      pollFactoryClassHash: "0x6",
      maci: "0x7",
      pollFactory: "0x8",
      coordinator: "0x9",
      deployer: "0xa",
      network: "starknet_local" as const,
      circuitProfile: "small",
      policy: "Free for all",
      voteBalanceAssigner: "Constant vote balance",
    };
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      expect(url).toBe("http://ops.test/macis/0x7");
      expect(init?.headers).toEqual({ authorization: "Bearer jwt" });

      return new Response(JSON.stringify(instance), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(client.readMaci("jwt", "0x7")).resolves.toEqual(instance);

    vi.unstubAllGlobals();
  });

  it("reads the current job", async () => {
    const job = { id: "job-1", kind: "standup", status: "running", steps: [] };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ job, incompleteStandUp: false, currentMaci: null }), { status: 200 }),
        ),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readJobState("jwt")).resolves.toEqual({ job, incompleteStandUp: false, currentMaci: null });

    vi.unstubAllGlobals();
  });

  it("discards an incomplete stand-up", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ discarded: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(client.discardStandUp("jwt")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("http://ops.test/standup/discard", {
      method: "POST",
      headers: { authorization: "Bearer jwt" },
    });

    vi.unstubAllGlobals();
  });

  it("throws the API error body when discard is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "busy" }), { status: 409 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.discardStandUp("jwt")).rejects.toThrow(/^busy$/u);

    vi.unstubAllGlobals();
  });

  it("throws discard failed when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: (): Promise<unknown> => Promise.reject(new Error("not json")),
      }),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.discardStandUp("jwt")).rejects.toThrow(/^discard failed$/u);

    vi.unstubAllGlobals();
  });

  it("reads no current job", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ job: null, incompleteStandUp: false, currentMaci: null }), { status: 200 }),
        ),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readJobState("jwt")).resolves.toEqual({
      job: undefined,
      incompleteStandUp: false,
      currentMaci: null,
    });

    vi.unstubAllGlobals();
  });

  it("throws the API error body when job read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "job failed" }), { status: 401 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readJobState("jwt")).rejects.toThrow(/^job failed$/u);

    vi.unstubAllGlobals();
  });

  it("throws when the MACI list body is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.listMacis("jwt", 1, 10)).rejects.toThrow(/^MACI list failed$/u);

    vi.unstubAllGlobals();
  });

  it("throws the API error body when a MACI instance is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "maci not found" }), { status: 404 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readMaci("jwt", "0x7")).rejects.toThrow(/^maci not found$/u);

    vi.unstubAllGlobals();
  });

  it("skips SSE frames that are not job events", async () => {
    const stream = new ReadableStream({
      start(controller): void {
        controller.enqueue(new TextEncoder().encode("event: ping\n\n"));
        controller.enqueue(new TextEncoder().encode("data: not-json\n\n"));
        controller.enqueue(new TextEncoder().encode('data: {"type":"nope"}\n\n'));
        controller.enqueue(
          new TextEncoder().encode('data: {"type":"step","step":{"seq":1,"kind":"declare","name":"LeanIMT"}}\n\n'),
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })),
    );

    const client = new OpsClient("http://ops.test");
    const events: unknown[] = [];

    await client.subscribeJobEvents("jwt", (event) => {
      events.push(event);
    });

    expect(events).toEqual([{ type: "step", step: { seq: 1, kind: "declare", name: "LeanIMT" } }]);

    vi.unstubAllGlobals();
  });

  it("throws the API error body when subscribe is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.subscribeJobEvents("jwt", (): void => undefined)).rejects.toThrow(/^unauthorized$/u);

    vi.unstubAllGlobals();
  });

  it("throws subscribe failed when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: (): Promise<unknown> => Promise.reject(new Error("not json")),
      }),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.subscribeJobEvents("jwt", (): void => undefined)).rejects.toThrow(/^subscribe failed$/u);

    vi.unstubAllGlobals();
  });

  it("throws subscribe failed when the response has no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      }),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.subscribeJobEvents("jwt", (): void => undefined)).rejects.toThrow(/^subscribe failed$/u);

    vi.unstubAllGlobals();
  });
});
