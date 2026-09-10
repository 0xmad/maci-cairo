import { BadRequestException, HttpException, UnauthorizedException, type ArgumentsHost } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";

import { LoginFilter } from "../login.filter.js";

function hostWithReply(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));
  const host = {
    switchToHttp: (): { getResponse: () => { status: typeof status } } => ({
      getResponse: (): { status: typeof status } => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, send };
}

describe("LoginFilter", () => {
  test("maps an HttpException object with error to that message", () => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch(new BadRequestException({ error: "nonce and signature required" }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ error: "nonce and signature required" });
  });

  test("maps an HttpException string body to that message", () => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch(new HttpException("plain", 400), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ error: "plain" });
  });

  test("maps an HttpException object with message when error is absent", () => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch(new HttpException({ message: "from-message" }, 422), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(send).toHaveBeenCalledWith({ error: "from-message" });
  });

  test("maps an HttpException object without error or message to failed", () => {
    const { host, send } = hostWithReply();

    new LoginFilter().catch(new HttpException({ statusCode: 400 }, 400), host);

    expect(send).toHaveBeenCalledWith({ error: "failed" });
  });

  test("maps an HttpException body that is not a string error or message to failed", () => {
    const { host, send } = hostWithReply();

    new LoginFilter().catch(new HttpException({ error: 1 }, 400), host);

    expect(send).toHaveBeenCalledWith({ error: "failed" });
  });

  test("maps UnauthorizedException to 401 with its error", () => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch(new UnauthorizedException({ error: "invalid token" }), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ error: "invalid token" });
  });

  test.each(["invalid nonce", "invalid token", "not allowlisted"] as const)("maps %s to 401", (message: string) => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch(new Error(message), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({ error: message });
  });

  test("maps any other Error to 400", () => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch(new Error("invalid signature"), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ error: "invalid signature" });
  });

  test("maps a non-Error throw to 400 failed", () => {
    const { host, status, send } = hostWithReply();

    new LoginFilter().catch("nope", host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ error: "failed" });
  });
});
