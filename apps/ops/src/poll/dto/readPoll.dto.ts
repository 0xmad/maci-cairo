import { IsString, MinLength } from "class-validator";

import { parseDto } from "../../utils/parseDto.js";
import { type Poll } from "../poll.store.js";

/** Path params for `GET /polls/:pollAddress`. */
export class ReadPollParamsDto {
  @IsString()
  @MinLength(1)
  pollAddress!: string;
}

/** Recorded Poll from `GET /polls/:pollAddress`. */
export class PollDto implements Poll {
  address!: string;

  pollId!: string;

  startDate!: string;

  endDate!: string;

  pollPublicKey!: readonly [string, string];

  createdAtMs!: number;

  maci!: string;
}

/** Reads the Poll address path param. */
export function parseReadPollParamsDto(params: unknown): string {
  return parseDto(ReadPollParamsDto, params, "poll address required").pollAddress;
}
