import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { LOGIN_SERVICE, LoginController } from "./login.controller.js";
import { LoginFilter } from "./login.filter.js";
import { LoginService } from "./services/login.service.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class LoginModule {
  static forRoot(loginService: LoginService): DynamicModule {
    return {
      module: LoginModule,
      controllers: [LoginController],
      providers: [
        { provide: LOGIN_SERVICE, useValue: loginService },
        { provide: APP_FILTER, useClass: LoginFilter },
      ],
    };
  }
}
