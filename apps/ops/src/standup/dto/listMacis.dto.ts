import { IsOptional } from "class-validator";

import { type Paginated, readPagination, type Pagination } from "../../utils/pagination.js";
import { type MaciListItem } from "../repositories/job.store.js";

import { parseDto } from "./parseDto.js";

/** Query for `GET /macis`. */
export class ListMacisQueryDto {
  @IsOptional()
  page?: string | number;

  @IsOptional()
  pageSize?: string | number;
}

/** Paginated MACI list from `GET /macis`. */
export class MacisPageDto implements Paginated<MaciListItem> {
  items!: MaciListItem[];

  total!: number;

  page!: number;

  pageSize!: number;
}

/** Reads page and pageSize, falling back to defaults for invalid values. */
export function parseListMacisQueryDto(query: unknown): Pagination {
  return readPagination(parseDto(ListMacisQueryDto, query, "invalid pagination", { whitelist: true }));
}
