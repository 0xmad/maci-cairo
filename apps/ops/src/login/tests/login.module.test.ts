/* eslint-disable import/order -- reflect-metadata must load before Nest */
import "reflect-metadata";
import { APP_FILTER, NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
/* eslint-enable import/order */

import { afterEach, describe, expect, test, vi } from "vitest";

import { LOGIN_SERVICE, LoginController } from "../login.controller.js";
import { LoginFilter } from "../login.filter.js";
import { LoginModule } from "../login.module.js";
import { type LoginService } from "../services/login.service.js";

describe("LoginModule", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    app = undefined;
  });

  async function compile(loginService: LoginService): Promise<NestFastifyApplication> {
    app = await NestFactory.create<NestFastifyApplication>(LoginModule.forRoot(loginService), new FastifyAdapter(), {
      logger: false,
    });

    return app;
  }

  test("injects the given LoginService into LoginController", async () => {
    const issueNonce = vi.fn((): Promise<string> => Promise.resolve("nonce-1"));
    const loginService = {
      issueNonce,
      login: vi.fn(),
      authenticate: vi.fn(),
    } as unknown as LoginService;
    const nest = await compile(loginService);

    expect(nest.get(LOGIN_SERVICE)).toBe(loginService);
    await expect(nest.get(LoginController).issueNonce()).resolves.toEqual({ nonce: "nonce-1" });
    expect(issueNonce).toHaveBeenCalledOnce();
  });

  test("registers LoginFilter as the HTTP exception filter", () => {
    const loginService = {
      issueNonce: vi.fn(),
      login: vi.fn(),
      authenticate: vi.fn(),
    } as unknown as LoginService;

    expect(LoginModule.forRoot(loginService).providers).toContainEqual({
      provide: APP_FILTER,
      useClass: LoginFilter,
    });
  });
});
