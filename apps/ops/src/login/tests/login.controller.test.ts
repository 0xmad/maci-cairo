import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { describe, expect, test, vi } from "vitest";

import { LoginController } from "../login.controller.js";
import { type LoginService, type OperatorSession } from "../services/login.service.js";

const SESSION: OperatorSession = {
  token: "jwt-token",
  address: "0x0000000000000000000000000000000000000000000000000000000000000001",
};

function controller(overrides: Partial<LoginService> = {}): {
  loginController: LoginController;
  issueNonce: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  authenticate: ReturnType<typeof vi.fn>;
} {
  const issueNonce = vi.fn((): Promise<string> => Promise.resolve("nonce-1"));
  const login = vi.fn((): Promise<OperatorSession> => Promise.resolve(SESSION));
  const authenticate = vi.fn((): Promise<string> => Promise.resolve(SESSION.address));
  const loginService = { issueNonce, login, authenticate, ...overrides } as unknown as LoginService;

  return {
    loginController: new LoginController(loginService),
    issueNonce,
    login,
    authenticate,
  };
}

function request(authorization?: string | string[]): FastifyRequest {
  return { headers: { authorization } } as unknown as FastifyRequest;
}

describe("LoginController", () => {
  test("issueNonce returns the service nonce", async () => {
    const { loginController, issueNonce } = controller();

    await expect(loginController.issueNonce()).resolves.toEqual({ nonce: "nonce-1" });
    expect(issueNonce).toHaveBeenCalledOnce();
  });

  test("signIn returns the Operator session for a valid body", async () => {
    const { loginController, login } = controller();

    await expect(loginController.signIn({ nonce: "nonce-1", signature: "sig" })).resolves.toEqual(SESSION);
    expect(login).toHaveBeenCalledWith("nonce-1", "sig");
  });

  test("signIn rejects a body without nonce and signature", async () => {
    const { loginController, login } = controller();

    await expect(loginController.signIn({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(loginController.signIn({})).rejects.toMatchObject({
      response: { error: "nonce and signature required" },
    });
    expect(login).not.toHaveBeenCalled();
  });

  test("signIn rejects extra fields on the login body", async () => {
    const { loginController, login } = controller();

    await expect(loginController.signIn({ nonce: "nonce-1", signature: "sig", extra: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(login).not.toHaveBeenCalled();
  });

  test("session returns the authenticated address for a Bearer token", async () => {
    const { loginController, authenticate } = controller();

    await expect(loginController.session(request("Bearer jwt-token"))).resolves.toEqual({ address: SESSION.address });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
  });

  test("session uses the first Authorization value when the header is an array", async () => {
    const { loginController, authenticate } = controller();

    await expect(loginController.session(request(["Bearer jwt-token", "Bearer other"]))).resolves.toEqual({
      address: SESSION.address,
    });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
  });

  test("session rejects a request without a Bearer token", async () => {
    const { loginController, authenticate } = controller();

    await expect(loginController.session(request())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(loginController.session(request())).rejects.toMatchObject({
      response: { error: "invalid token" },
    });
    expect(authenticate).not.toHaveBeenCalled();
  });
});
