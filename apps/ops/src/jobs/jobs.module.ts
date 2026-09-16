import { type DynamicModule, Module } from "@nestjs/common";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";
import { STANDUP_SERVICE, type StandupService } from "../standup/standup.service.js";

import { type JobEvents } from "./job.events.js";
import { type JobStore } from "./job.store.js";
import { JOB_EVENTS, JOB_STORE, JobsController } from "./jobs.controller.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class JobsModule {
  static forRoot(
    loginService: LoginService,
    standupService: StandupService,
    jobs: JobStore,
    events: JobEvents,
  ): DynamicModule {
    return {
      module: JobsModule,
      controllers: [JobsController],
      providers: [
        { provide: LOGIN_SERVICE, useValue: loginService },
        { provide: STANDUP_SERVICE, useValue: standupService },
        { provide: JOB_STORE, useValue: jobs },
        { provide: JOB_EVENTS, useValue: events },
      ],
    };
  }
}
