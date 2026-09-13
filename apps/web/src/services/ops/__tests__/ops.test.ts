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

  it("starts MACI stand-up with the Operator JWT and no RPC body", async () => {
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
      expect(init?.headers).toEqual({ authorization: "Bearer jwt" });
      expect(init?.body).toBeUndefined();

      return new Response(JSON.stringify({ jobId: "job-1" }), { status: 201 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new OpsClient("http://ops.test");

    await expect(client.startStandUp("jwt")).resolves.toBe("job-1");

    vi.unstubAllGlobals();
  });

  it("throws busy when a second stand-up is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "busy" }), { status: 409 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.startStandUp("jwt")).rejects.toThrow(/^busy$/u);

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
          items: [{ address: "0x7", network: "starknet_local" }],
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
      items: [{ address: "0x7", network: "starknet_local" }],
      total: 11,
      page: 2,
      pageSize: 10,
    });

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ job }), { status: 200 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.readJob("jwt")).resolves.toEqual(job);

    vi.unstubAllGlobals();
  });

  it("reads no current job", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ job: null }), { status: 200 })));

    const client = new OpsClient("http://ops.test");

    await expect(client.readJob("jwt")).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("throws the API error body when job read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "job failed" }), { status: 401 })),
    );

    const client = new OpsClient("http://ops.test");

    await expect(client.readJob("jwt")).rejects.toThrow(/^job failed$/u);

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
