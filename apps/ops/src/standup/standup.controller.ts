import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Sse,
  UnauthorizedException,
} from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";
import { readBearer } from "../login/utils/bearer.js";

import { type CurrentMaci, type JobSnapshot } from "./repositories/job.store.js";
import { type JobEvent, StandupService } from "./standup.service.js";

export const STANDUP_SERVICE = "STANDUP_SERVICE";

@Controller()
export class StandupController {
  constructor(
    @Inject(LOGIN_SERVICE) private readonly loginService: LoginService,
    @Inject(STANDUP_SERVICE) private readonly standupService: StandupService,
  ) {}

  @Post("standup")
  async startStandUp(@Req() request: FastifyRequest): Promise<{ jobId: string }> {
    await this.requireOperator(request);

    try {
      return await this.standupService.startStandUp();
    } catch (caught) {
      if (caught instanceof Error && caught.message === "busy") {
        throw new ConflictException({ error: "busy" });
      }

      throw caught instanceof Error ? caught : new BadRequestException({ error: "failed" });
    }
  }

  @Get("maci")
  async readCurrentMaci(@Req() request: FastifyRequest): Promise<{ maci: CurrentMaci | null }> {
    await this.requireOperator(request);

    return { maci: (await this.standupService.currentMaci()) ?? null };
  }

  @Get("job")
  async readCurrentJob(@Req() request: FastifyRequest): Promise<{ job: JobSnapshot | null }> {
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
