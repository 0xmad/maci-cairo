import { type DynamicModule, Module } from "@nestjs/common";

import { type RelayerAccount } from "../account/types.js";

import { SIGNUP_SERVICE, SignupController } from "./signup.controller.js";
import { SignupService } from "./signup.service.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class SignupModule {
  static forRoot(account: RelayerAccount): DynamicModule {
    return {
      module: SignupModule,
      controllers: [SignupController],
      providers: [{ provide: SIGNUP_SERVICE, useValue: new SignupService(account) }],
    };
  }
}
