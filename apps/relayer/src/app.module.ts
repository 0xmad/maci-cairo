import { type DynamicModule, Module } from "@nestjs/common";

import { type RelayerAccount } from "./account/types.js";
import { HealthController } from "./health/health.controller.js";
import { SignupModule } from "./signup/signup.module.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({})
export class AppModule {
  static forRoot(account: RelayerAccount): DynamicModule {
    return {
      module: AppModule,
      imports: [SignupModule.forRoot(account)],
      controllers: [HealthController],
    };
  }
}
