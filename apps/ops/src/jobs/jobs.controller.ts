import { Controller, Get, Inject, Req, Sse, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";
import { readBearer } from "../login/utils/bearer.js";
import { STANDUP_SERVICE, type StandupService } from "../standup/standup.service.js";

import { CurrentJobResponseDto } from "./dto/currentJob.dto.js";
import { type JobEvent, JobEvents } from "./job.events.js";
import { type JobStore } from "./job.store.js";

export const JOB_STORE = "JOB_STORE";
export const JOB_EVENTS = "JOB_EVENTS";

@Controller()
export class JobsController {
  constructor(
    @Inject(LOGIN_SERVICE) private readonly loginService: LoginService,
    @Inject(JOB_STORE) private readonly jobs: JobStore,
    @Inject(JOB_EVENTS) private readonly events: JobEvents,
    @Inject(STANDUP_SERVICE) private readonly standupService: StandupService,
  ) {}

  @Get("job")
  async readCurrentJob(@Req() request: FastifyRequest): Promise<CurrentJobResponseDto> {
    await this.requireOperator(request);

    return {
      job: (await this.jobs.latest()) ?? null,
      incompleteStandUp: await this.standupService.hasIncompleteStandUp(),
      currentMaci: (await this.standupService.currentMaciInstance())?.maci ?? null,
    };
  }

  @Sse("job/events")
  async subscribe(@Req() request: FastifyRequest): Promise<Observable<{ type?: string; data: JobEvent }>> {
    await this.requireOperator(request);
    const job = await this.jobs.latest();

    return new Observable((subscriber) => {
      let closed = false;

      const unsub = this.events.subscribe(job, (event: JobEvent) => {
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
        unsub();
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
