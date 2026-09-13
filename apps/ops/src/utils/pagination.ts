export interface Pagination {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export type Paginated<T> = Page<T> & Pagination;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function readPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

/** Parse `page` / `pageSize` query values. Invalid tokens fall back to defaults. */
export function readPagination(query: unknown): Pagination {
  const record = typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};

  return {
    page: readPositiveInt(record.page, DEFAULT_PAGE),
    pageSize: Math.min(readPositiveInt(record.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
  };
}
