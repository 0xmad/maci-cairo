import { IsOptional } from "class-validator";

import { type Paginated, readPagination, type Pagination } from "../../utils/pagination.js";
import { parseDto } from "../../utils/parseDto.js";
import { type PollListItem } from "../poll.store.js";

/** Query for `GET /macis/:address/polls`. */
export class ListPollsQueryDto {
  @IsOptional()
  page?: string | number;

  @IsOptional()
  pageSize?: string | number;
}

/** Paginated Poll list from `GET /macis/:address/polls`. */
export class PollsPageDto implements Paginated<PollListItem> {
  items!: PollListItem[];

  total!: number;

  page!: number;

  pageSize!: number;
}

/** Reads page and pageSize, falling back to defaults for invalid values. */
export function parseListPollsQueryDto(query: unknown): Pagination {
  return readPagination(parseDto(ListPollsQueryDto, query, "invalid pagination", { whitelist: true }));
}
