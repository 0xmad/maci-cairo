import { Module } from "@nestjs/common";

import { HealthController } from "./health/health.controller.js";

/* eslint-disable @typescript-eslint/no-extraneous-class -- NestFactory needs a module class token */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
