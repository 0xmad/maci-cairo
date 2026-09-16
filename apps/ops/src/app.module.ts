import { type DynamicModule, Module } from "@nestjs/common";

import { type JobEvents } from "./jobs/job.events.js";
import { type JobStore } from "./jobs/job.store.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { LoginModule } from "./login/login.module.js";
import { type LoginService } from "./login/services/login.service.js";
import { PollModule } from "./poll/poll.module.js";
import { type PollService } from "./poll/poll.service.js";
import { StandupModule } from "./standup/standup.module.js";
import { type StandupService } from "./standup/standup.service.js";

export interface AppDeps {
  loginService: LoginService;
  standupService: StandupService;
  pollService: PollService;
  jobs: JobStore;
  events: JobEvents;
}

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class AppModule {
  static forRoot(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoginModule.forRoot(deps.loginService),
        StandupModule.forRoot(deps.loginService, deps.standupService),
        PollModule.forRoot(deps.loginService, deps.pollService),
        JobsModule.forRoot(deps.loginService, deps.standupService, deps.jobs, deps.events),
      ],
    };
  }
}
