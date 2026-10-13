import { afterEach, describe, expect, test } from "vitest";

import { createServer, listenPort, type RunningServer } from "../server.js";

describe("createServer", () => {
  let server: RunningServer | undefined;

  afterEach(async () => {
    if (server !== undefined) {
      await server.close();
    }

    server = undefined;
  });

  test("returns the TCP port", () => {
    expect(listenPort({ port: 8788 })).toBe(8788);
  });

  test("rejects a missing or pipe address", () => {
    expect(() => listenPort(null)).toThrow(/expected a TCP port/u);
    expect(() => listenPort("/tmp/maci.sock")).toThrow(/expected a TCP port/u);
  });

  test("GET /health names the Relayer", async () => {
    server = await createServer(0);
    const res = await fetch(`http://127.0.0.1:${server.port}/health`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ service: "Relayer" });
  });

  test("close stops accepting connections", async () => {
    server = await createServer(0);
    const base = `http://127.0.0.1:${server.port}`;
    await server.close();
    server = undefined;

    await expect(fetch(`${base}/health`)).rejects.toThrow();
  });
});
