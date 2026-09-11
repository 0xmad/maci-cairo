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
});
