import { IsString, MinLength } from "class-validator";
import { type MaciNetwork } from "maci-deploy/maci";

import { parseDto } from "./parseDto.js";

/** Path params for `GET /macis/:address`. */
export class ReadMaciParamsDto {
  @IsString()
  @MinLength(1)
  address!: string;
}

/** Recorded MACI instance from `GET /macis/:address`. */
export class MaciInstanceDto {
  leanImt!: string;

  checker!: string;

  enforcer!: string;

  assigner!: string;

  pollClassHash!: string;

  pollFactoryClassHash!: string;

  maci!: string;

  pollFactory!: string;

  coordinator!: string;

  deployer!: string;

  network!: MaciNetwork;

  circuitProfile!: string;

  policy!: string;

  voteBalanceAssigner!: string;
}

/** Reads the MACI address path param. */
export function parseReadMaciParamsDto(params: unknown): string {
  return parseDto(ReadMaciParamsDto, params, "maci address required").address;
}
