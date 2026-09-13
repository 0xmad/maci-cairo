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
  Sse,
  UnauthorizedException,
} from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";
import { readBearer } from "../login/utils/bearer.js";

import { CurrentJobResponseDto } from "./dto/currentJob.dto.js";
import { ListMacisQueryDto, MacisPageDto, parseListMacisQueryDto } from "./dto/listMacis.dto.js";
import { MaciInstanceDto, parseReadMaciParamsDto, ReadMaciParamsDto } from "./dto/readMaci.dto.js";
import { StandUpCatalogDto } from "./dto/standUpCatalog.dto.js";
import { parseStartStandUpDto, StartStandUpDto, StartStandUpResponseDto } from "./dto/startStandUp.dto.js";
import { type JobEvent, StandupService } from "./standup.service.js";

export const STANDUP_SERVICE = "STANDUP_SERVICE";

const OPERATOR_STANDUP_ERRORS = new Set(["Zero vote balance", "Vote balance too large"]);

function isOperatorStandUpError(message: string): boolean {
  return (
    OPERATOR_STANDUP_ERRORS.has(message) ||
    message.startsWith("unknown circuit profile:") ||
    message.startsWith("unknown policy:") ||
    message.startsWith("unknown assigner:")
  );
}

function httpErrorForStandUpStart(caught: unknown): Error {
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
      throw httpErrorForStandUpStart(caught);
    }
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

  @Get("job")
  async readCurrentJob(@Req() request: FastifyRequest): Promise<CurrentJobResponseDto> {
    await this.requireOperator(request);

    return { job: (await this.standupService.currentJob()) ?? null };
  }

  @Sse("job/events")
  async subscribe(@Req() request: FastifyRequest): Promise<Observable<{ type?: string; data: JobEvent }>> {
    await this.requireOperator(request);

    return new Observable((subscriber) => {
      let closed = false;

      const unsubPromise = this.standupService.subscribe((event: JobEvent) => {
        if (closed) {
          return;
        }

        subscriber.next({ type: event.type, data: event });

        if (event.type === "completed") {
          closed = true;
          subscriber.complete();
        }
      });

      return (): void => {
        closed = true;

        unsubPromise.then(
          (unsub) => {
            unsub();
          },
          () => undefined,
        );
      };
    });
  }

  private async requireOperator(request: FastifyRequest): Promise<void> {
    const token = readBearer(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException({ error: "invalid token" });
    }

    await this.loginService.authenticate(token);
  }
}
