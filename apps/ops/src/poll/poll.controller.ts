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
import { parseReadMaciParamsDto, ReadMaciParamsDto } from "../standup/dto/readMaci.dto.js";

import { ListPollsQueryDto, parseListPollsQueryDto, PollsPageDto } from "./dto/listPolls.dto.js";
import { parseReadPollParamsDto, PollDto, ReadPollParamsDto } from "./dto/readPoll.dto.js";
import { parseStartCreatePollDto, StartCreatePollDto, StartCreatePollResponseDto } from "./dto/startCreatePoll.dto.js";
import { PollService } from "./poll.service.js";

export const POLL_SERVICE = "POLL_SERVICE";

function httpErrorForPoll(caught: unknown): Error {
  if (caught instanceof Error && caught.message === "busy") {
    return new ConflictException({ error: "busy" });
  }

  if (caught instanceof Error && (caught.message === "maci not found" || caught.message === "poll not found")) {
    return new NotFoundException({ error: caught.message });
  }

  if (caught instanceof Error && caught.message === "incomplete stand-up") {
    return new BadRequestException({ error: caught.message });
  }

  return caught instanceof Error ? caught : new BadRequestException({ error: "failed" });
}

@Controller()
export class PollController {
  constructor(
    @Inject(LOGIN_SERVICE) private readonly loginService: LoginService,
    @Inject(POLL_SERVICE) private readonly pollService: PollService,
  ) {}

  @Get("polls/:pollAddress")
  async readPoll(@Req() request: FastifyRequest, @Param() params: ReadPollParamsDto): Promise<PollDto> {
    await this.requireOperator(request);

    try {
      return await this.pollService.readPoll(parseReadPollParamsDto(params));
    } catch (caught) {
      throw httpErrorForPoll(caught);
    }
  }

  @Get("macis/:address/polls")
  async listPolls(
    @Req() request: FastifyRequest,
    @Param() params: ReadMaciParamsDto,
    @Query() query: ListPollsQueryDto,
  ): Promise<PollsPageDto> {
    await this.requireOperator(request);

    const pagination = parseListPollsQueryDto(query);

    try {
      return { ...(await this.pollService.listPolls(parseReadMaciParamsDto(params), pagination)), ...pagination };
    } catch (caught) {
      throw httpErrorForPoll(caught);
    }
  }

  @Post("macis/:address/poll")
  async startCreatePoll(
    @Req() request: FastifyRequest,
    @Param() params: ReadMaciParamsDto,
    @Body() body: StartCreatePollDto,
  ): Promise<StartCreatePollResponseDto> {
    await this.requireOperator(request);

    try {
      return await this.pollService.startCreatePoll(parseReadMaciParamsDto(params), parseStartCreatePollDto(body));
    } catch (caught) {
      throw httpErrorForPoll(caught);
    }
  }

  private async requireOperator(request: FastifyRequest): Promise<void> {
    const token = readBearer(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException({ error: "invalid token" });
    }

    await this.loginService.authenticate(token);
  }
}
