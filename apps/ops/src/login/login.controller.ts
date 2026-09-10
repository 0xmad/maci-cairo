import { BadRequestException, Body, Controller, Get, Inject, Post, Req, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { strictObject, string } from "zod";

import { LoginService, type OperatorSession } from "./services/login.service.js";
import { readBearer } from "./utils/bearer.js";

export const LOGIN_SERVICE = "LOGIN_SERVICE";

const loginBodySchema = strictObject({
  nonce: string().min(1),
  signature: string().min(1),
});

@Controller()
export class LoginController {
  constructor(@Inject(LOGIN_SERVICE) private readonly loginService: LoginService) {}

  @Post("nonce")
  async issueNonce(): Promise<{ nonce: string }> {
    return { nonce: await this.loginService.issueNonce() };
  }

  @Post("login")
  async signIn(@Body() body: unknown): Promise<OperatorSession> {
    const parsed = loginBodySchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({ error: "nonce and signature required" });
    }

    return this.loginService.login(parsed.data.nonce, parsed.data.signature);
  }

  @Get("me")
  async session(@Req() request: FastifyRequest): Promise<{ address: string }> {
    const token = readBearer(request.headers.authorization);

    if (token === undefined) {
      throw new UnauthorizedException({ error: "invalid token" });
    }

    return { address: await this.loginService.authenticate(token) };
  }
}
