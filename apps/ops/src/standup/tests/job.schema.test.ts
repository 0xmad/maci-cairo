import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import { jobSteps } from "../repositories/job.schema.js";

describe("job schema", () => {
  test("job_steps is keyed by jobId and seq", () => {
    const { primaryKeys } = getTableConfig(jobSteps);

    expect(primaryKeys).toHaveLength(1);
    expect(primaryKeys[0]?.columns.map((column) => column.name)).toEqual(["job_id", "seq"]);
  });
});
