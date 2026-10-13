import { describe, expect, test } from "vitest";

import { HealthController } from "../health.controller.js";

describe("HealthController", () => {
  test("names the Relayer", () => {
    expect(new HealthController().health()).toEqual({ service: "Relayer" });
  });
});
