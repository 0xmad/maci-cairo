import { afterEach, describe, expect, test, vi } from "vitest";

import { type LoginService } from "../login/services/login.service.js";
import { createServer, listenPort, type RunningServer } from "../server.js";
import { type StandupService } from "../standup/standup.service.js";

function loginService(): LoginService {
  return {
    issueNonce: vi.fn((): Promise<string> => Promise.resolve("nonce-1")),
    login: vi.fn(),
    authenticate: vi.fn(),
  } as unknown as LoginService;
}

function standupService(): StandupService {
  return {
    startStandUp: vi.fn(),
    currentJob: vi.fn(),
    currentMaci: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as StandupService;
}

function deps(): { loginService: LoginService; standupService: StandupService } {
  return { loginService: loginService(), standupService: standupService() };
}

describe("listenPort", () => {
  test("returns the TCP port", () => {
    expect(listenPort({ port: 8787 })).toBe(8787);
  });

  test("rejects a missing or pipe address", () => {
    expect(() => listenPort(null)).toThrow(/expected a TCP port/u);
    expect(() => listenPort("/tmp/maci.sock")).toThrow(/expected a TCP port/u);
  });
});

describe("createServer", () => {
  let server: RunningServer | undefined;

  afterEach(async () => {
    if (server !== undefined) {
      await server.close();
    }

    server = undefined;
  });

  test("listens on a TCP port and serves POST /nonce", async () => {
    server = await createServer(deps(), 0);
    const res = await fetch(`http://127.0.0.1:${server.port}/nonce`, { method: "POST" });

    expect(server.port).toBeGreaterThan(0);
    expect(res.ok).toBe(true);
    await expect(res.json()).resolves.toEqual({ nonce: "nonce-1" });
  });

  test("enables CORS for browser origins and authorization", async () => {
    server = await createServer(deps(), 0);
    const res = await fetch(`http://127.0.0.1:${server.port}/nonce`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
      },
    });

    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-methods")).toMatch(/POST/u);
    expect(res.headers.get("access-control-allow-headers")).toMatch(/authorization/iu);
  });

  test("close stops accepting connections", async () => {
    server = await createServer(deps(), 0);
    const base = `http://127.0.0.1:${server.port}`;
    await server.close();
    server = undefined;

    await expect(fetch(`${base}/nonce`, { method: "POST" })).rejects.toThrow();
  });
});
