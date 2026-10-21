/* eslint-disable import/order -- reflect-metadata must load before Nest */
import "reflect-metadata";
import { BadRequestException, StandardSchemaValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
/* eslint-enable import/order */

import { type PaidInvocation, type RelayerAccount } from "./account/types.js";
import { AppModule } from "./app.module.js";

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

export function listenPort(address: string | { port: number } | null): number {
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP port");
  }

  return address.port;
}

const unconfiguredAccount: RelayerAccount = {
  address: "0x0",
  invokeAndPay(): Promise<PaidInvocation> {
    return Promise.reject(new Error("Relayer account is not configured"));
  },
};

/** HTTP process for the Relayer. Listens on loopback. */
export async function createServer(
  port: number,
  account: RelayerAccount = unconfiguredAccount,
): Promise<RunningServer> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(account), new FastifyAdapter(), {
    logger: false,
  });

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: () => new BadRequestException({ error: "Invalid request" }),
    }),
  );

  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"],
  });

  await app.listen(port, "127.0.0.1");

  return {
    port: listenPort(app.getHttpServer().address()),
    async close(): Promise<void> {
      await app.close();
    },
  };
}
