import { BadRequestException } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { type DeployMaciIntent } from "maci-deploy/intent";

import { parseDto } from "../../utils/parseDto.js";

const REQUIRED_BODY_ERROR = "circuitProfile, policy, and assigner required";

/** Operator JSON body for `POST /standup`. */
export class StartStandUpDto {
  @IsString()
  @MinLength(1)
  circuitProfile!: string;

  @IsString()
  @MinLength(1)
  policy!: string;

  @IsString()
  @MinLength(1)
  assigner!: string;

  @IsOptional()
  voteBalance?: string | number;
}

/** Job id returned after `POST /standup`. */
export class StartStandUpResponseDto {
  jobId!: string;
}

/** Validates Operator stand-up JSON and maps it to deploy intent. */
export function parseStartStandUpDto(body: unknown): DeployMaciIntent {
  const dto = parseDto(StartStandUpDto, body, REQUIRED_BODY_ERROR);
  const intent: DeployMaciIntent = {
    circuitProfile: dto.circuitProfile,
    policy: dto.policy,
    assigner: dto.assigner,
  };

  if (dto.voteBalance !== undefined) {
    if (typeof dto.voteBalance === "number" && !Number.isInteger(dto.voteBalance)) {
      throw new BadRequestException({ error: "invalid vote balance" });
    }

    try {
      intent.constantVoteBalance = BigInt(dto.voteBalance);
    } catch {
      throw new BadRequestException({ error: "invalid vote balance" });
    }
  }

  return intent;
}
