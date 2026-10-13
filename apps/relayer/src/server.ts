/* eslint-disable import/order -- reflect-metadata must load before Nest */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
/* eslint-enable import/order */

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

/** HTTP process for the Relayer. Listens on loopback. */
export async function createServer(port: number): Promise<RunningServer> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

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
