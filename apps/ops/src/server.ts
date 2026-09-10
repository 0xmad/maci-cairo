/* eslint-disable import/order -- reflect-metadata must load before Nest */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
/* eslint-enable import/order */

import { AppModule, type AppDeps } from "./app.module.js";

export interface RunningServer {
  close: () => Promise<void>;
  port: number;
}

export function listenPort(address: string | { port: number } | null): number {
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP port");
  }

  return address.port;
}

/** HTTP process adapter. Feature modules register through `AppModule`. */
export async function createServer(deps: AppDeps, port: number, host = "127.0.0.1"): Promise<RunningServer> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(deps), new FastifyAdapter(), {
    logger: false,
  });

  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type"],
  });

  await app.listen(port, host);

  return {
    port: listenPort(app.getHttpServer().address()),
    async close(): Promise<void> {
      await app.close();
    },
  };
}
