import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { type FastifyRequest } from "fastify";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";
import { readBearer } from "../login/utils/bearer.js";

import { ListMacisQueryDto, MacisPageDto, parseListMacisQueryDto } from "./dto/listMacis.dto.js";
import { MaciInstanceDto, parseReadMaciParamsDto, ReadMaciParamsDto } from "./dto/readMaci.dto.js";
import { StandUpCatalogDto } from "./dto/standUpCatalog.dto.js";
import { parseStartStandUpDto, StartStandUpDto, StartStandUpResponseDto } from "./dto/startStandUp.dto.js";
import { STANDUP_SERVICE, StandupService } from "./standup.service.js";

const OPERATOR_STANDUP_ERRORS = new Set(["Zero vote balance", "Vote balance too large"]);

function isOperatorStandUpError(message: string): boolean {
  return (
    OPERATOR_STANDUP_ERRORS.has(message) ||
    message.startsWith("unknown circuit profile:") ||
    message.startsWith("unknown policy:") ||
    message.startsWith("unknown assigner:")
  );
}

function httpErrorForStandUp(caught: unknown): Error {
  if (caught instanceof Error && caught.message === "busy") {
    return new ConflictException({ error: "busy" });
  }

  if (caught instanceof Error && isOperatorStandUpError(caught.message)) {
    return new BadRequestException({ error: caught.message });
  }

  return caught instanceof Error ? caught : new BadRequestException({ error: "failed" });
}

@Controller()
export class StandupController {
  constructor(
    @Inject(LOGIN_SERVICE) private readonly loginService: LoginService,
    @Inject(STANDUP_SERVICE) private readonly standupService: StandupService,
  ) {}

  @Get("standup")
  async readStandUpCatalog(@Req() request: FastifyRequest): Promise<StandUpCatalogDto> {
    await this.requireOperator(request);

    return this.standupService.readStandUpCatalog();
  }

  @Post("standup")
  async startStandUp(@Req() request: FastifyRequest, @Body() body: StartStandUpDto): Promise<StartStandUpResponseDto> {
    await this.requireOperator(request);

    try {
      return await this.standupService.startStandUp(parseStartStandUpDto(body));
    } catch (caught) {
      throw httpErrorForStandUp(caught);
    }
  }

  @Post("standup/discard")
  async discardStandUp(@Req() request: FastifyRequest): Promise<{ discarded: true }> {
    await this.requireOperator(request);

    try {
      await this.standupService.discardStandUp();
    } catch (caught) {
      throw httpErrorForStandUp(caught);
    }

    return { discarded: true };
  }

  @Get("macis")
  async listMacis(@Req() request: FastifyRequest, @Query() query: ListMacisQueryDto): Promise<MacisPageDto> {
    await this.requireOperator(request);

    const pagination = parseListMacisQueryDto(query);

    return { ...(await this.standupService.listMacis(pagination)), ...pagination };
  }

  @Get("macis/:address")
  async readMaci(@Req() request: FastifyRequest, @Param() params: ReadMaciParamsDto): Promise<MaciInstanceDto> {
    await this.requireOperator(request);

    const address = parseReadMaciParamsDto(params);
    const maci = await this.standupService.readMaci(address);

    if (maci === undefined) {
      throw new NotFoundException({ error: "maci not found" });
    }

    return maci;
  }

  private async requireOperator(request: FastifyRequest): Promise<void> {
    const token = readBearer(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException({ error: "invalid token" });
    }

    await this.loginService.authenticate(token);
  }
}
