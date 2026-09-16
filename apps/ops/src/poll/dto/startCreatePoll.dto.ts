import { BadRequestException } from "@nestjs/common";
import { Allow, ArrayMaxSize, ArrayMinSize, IsArray } from "class-validator";

import { parseDto } from "../../utils/parseDto.js";
import { type CreatePollIntent } from "../poll.store.js";

const REQUIRED_BODY_ERROR = "startDate, endDate, and pollPublicKey required";

/** Operator JSON body for `POST /macis/:address/poll`. */
export class StartCreatePollDto {
  @Allow()
  startDate!: string | number;

  @Allow()
  endDate!: string | number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  pollPublicKey!: [string | number, string | number];
}

/** Job id returned after `POST /macis/:address/poll`. */
export class StartCreatePollResponseDto {
  jobId!: string;
}

function parseUint(value: unknown, error: string): bigint {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException({ error });
    }

    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^(?:0x[0-9a-fA-F]+|[0-9]+)$/u.test(trimmed)) {
      return BigInt(trimmed);
    }
  }

  throw new BadRequestException({ error });
}

/** Validates Operator Create Poll JSON. MACI address is never accepted. */
export function parseStartCreatePollDto(body: unknown): CreatePollIntent {
  const dto = parseDto(StartCreatePollDto, body, REQUIRED_BODY_ERROR, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  return {
    startDate: parseUint(dto.startDate, "invalid startDate"),
    endDate: parseUint(dto.endDate, "invalid endDate"),
    pollPublicKey: [
      parseUint(dto.pollPublicKey[0], "invalid pollPublicKey"),
      parseUint(dto.pollPublicKey[1], "invalid pollPublicKey"),
    ],
  };
}
