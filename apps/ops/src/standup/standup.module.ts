import { type DynamicModule, Module } from "@nestjs/common";

import { LOGIN_SERVICE } from "../login/login.controller.js";
import { type LoginService } from "../login/services/login.service.js";

import { STANDUP_SERVICE, StandupController } from "./standup.controller.js";
import { StandupService } from "./standup.service.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class StandupModule {
  static forRoot(loginService: LoginService, standupService: StandupService): DynamicModule {
    return {
      module: StandupModule,
      controllers: [StandupController],
      providers: [
        { provide: LOGIN_SERVICE, useValue: loginService },
        { provide: STANDUP_SERVICE, useValue: standupService },
      ],
    };
  }
}
