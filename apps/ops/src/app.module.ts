import { type DynamicModule, Module } from "@nestjs/common";

import { LoginModule } from "./login/login.module.js";
import { type LoginService } from "./login/services/login.service.js";
import { StandupModule } from "./standup/standup.module.js";
import { type StandupService } from "./standup/standup.service.js";

export interface AppDeps {
  loginService: LoginService;
  standupService: StandupService;
}

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class AppModule {
  static forRoot(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [LoginModule.forRoot(deps.loginService), StandupModule.forRoot(deps.loginService, deps.standupService)],
    };
  }
}
