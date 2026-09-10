import { type DynamicModule, Module } from "@nestjs/common";

import { LoginModule } from "./login/login.module.js";
import { type LoginService } from "./login/services/login.service.js";

export interface AppDeps {
  loginService: LoginService;
}

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class AppModule {
  static forRoot(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [LoginModule.forRoot(deps.loginService)],
    };
  }
}
