import { afterEach, describe, expect, it, vi } from "vitest";

import { opsBaseUrl } from "../ops";

describe("opsBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns VITE_BACKEND_OPS_URL when set", () => {
    vi.stubEnv("VITE_BACKEND_OPS_URL", "http://ops.test");

    expect(opsBaseUrl()).toBe("http://ops.test");
  });

  it("proxies loopback ops through Vite in development", () => {
    vi.stubEnv("DEV", true);
    const env = import.meta.env as { VITE_BACKEND_OPS_URL?: string };

    delete env.VITE_BACKEND_OPS_URL;

    expect(opsBaseUrl()).toBe(`${window.location.origin}/ops`);

    vi.stubEnv("VITE_BACKEND_OPS_URL", "http://127.0.0.1:8787");

    expect(opsBaseUrl()).toBe(`${window.location.origin}/ops`);
  });

  it("keeps a configured ops URL that is not a valid loopback URL", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_BACKEND_OPS_URL", "http://[");

    expect(opsBaseUrl()).toBe("http://[");
  });

  it("returns the local default when unset outside development", () => {
    vi.stubEnv("DEV", false);
    const env = import.meta.env as { VITE_BACKEND_OPS_URL?: string };

    delete env.VITE_BACKEND_OPS_URL;

    expect(opsBaseUrl()).toBe("http://127.0.0.1:8787");
  });
});
