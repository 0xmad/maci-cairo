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

  it("returns the local default when unset", () => {
    const env = import.meta.env as { VITE_BACKEND_OPS_URL?: string };

    delete env.VITE_BACKEND_OPS_URL;

    expect(opsBaseUrl()).toBe("http://127.0.0.1:8787");
  });
});
