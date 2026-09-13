import { describe, expect, test } from "vitest";

import { readPagination } from "../pagination.js";

describe("readPagination", () => {
  test("defaults to page 1 and pageSize 10", () => {
    expect(readPagination(undefined)).toEqual({ page: 1, pageSize: 10 });
    expect(readPagination({})).toEqual({ page: 1, pageSize: 10 });
  });

  test("reads page and pageSize from query strings", () => {
    expect(readPagination({ page: "2", pageSize: "1" })).toEqual({ page: 2, pageSize: 1 });
  });

  test("reads page and pageSize from numbers", () => {
    expect(readPagination({ page: 3, pageSize: 5 })).toEqual({ page: 3, pageSize: 5 });
  });

  test("caps pageSize at 50", () => {
    expect(readPagination({ pageSize: "100" })).toEqual({ page: 1, pageSize: 50 });
  });

  test("falls back when page or pageSize is not a positive integer", () => {
    expect(readPagination({ page: "0", pageSize: "nope" })).toEqual({ page: 1, pageSize: 10 });
  });
});
