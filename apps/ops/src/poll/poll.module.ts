import { type DynamicModule, Module } from "@nestjs/common";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";

import { POLL_SERVICE, PollController } from "./poll.controller.js";
import { PollService } from "./poll.service.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class PollModule {
  static forRoot(loginService: LoginService, pollService: PollService): DynamicModule {
    return {
      module: PollModule,
      controllers: [PollController],
      providers: [
        { provide: LOGIN_SERVICE, useValue: loginService },
        { provide: POLL_SERVICE, useValue: pollService },
      ],
    };
  }
}
