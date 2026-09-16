import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { describe, expect, test, vi } from "vitest";

import { type LoginService } from "../../login/services/login.service.js";
import { type StartCreatePollDto } from "../dto/startCreatePoll.dto.js";
import { PollController } from "../poll.controller.js";
import { type PollService } from "../poll.service.js";

const OPERATOR = "0x0000000000000000000000000000000000000000000000000000000000000001";
const MACI = "0x7";

const POLL_BODY = {
  startDate: 0,
  endDate: 1000,
  pollPublicKey: [0, 1] as [number, number],
};

function harness(pollOverrides: Partial<PollService> = {}, loginOverrides: Partial<LoginService> = {}) {
  const authenticate = vi.fn((): Promise<string> => Promise.resolve(OPERATOR));
  const startCreatePoll = vi.fn((): Promise<{ jobId: string }> => Promise.resolve({ jobId: "job-2" }));
  const listPolls = vi.fn((): Promise<{ items: never[]; total: number }> => Promise.resolve({ items: [], total: 0 }));
  const loginService = { authenticate, ...loginOverrides } as unknown as LoginService;
  const pollService = { startCreatePoll, listPolls, ...pollOverrides } as unknown as PollService;

  return {
    pollController: new PollController(loginService, pollService),
    authenticate,
    startCreatePoll,
    listPolls,
  };
}

function request(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as unknown as FastifyRequest;
}

function pollBody(body: unknown): StartCreatePollDto {
  return body as StartCreatePollDto;
}

describe("PollController", () => {
  test("startCreatePoll returns the job id for an authenticated Operator", async () => {
    const { pollController, authenticate, startCreatePoll } = harness();

    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).resolves.toEqual({
      jobId: "job-2",
    });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
    expect(startCreatePoll).toHaveBeenCalledWith(MACI, {
      startDate: 0n,
      endDate: 1000n,
      pollPublicKey: [0n, 1n],
    });
  });

  test("startCreatePoll rejects a pasted MACI address", async () => {
    const { pollController, startCreatePoll } = harness();

    await expect(
      pollController.startCreatePoll(
        request("Bearer jwt-token"),
        { address: MACI },
        pollBody({ ...POLL_BODY, maci: "0x1" }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(startCreatePoll).not.toHaveBeenCalled();
  });

  test("startCreatePoll maps a missing MACI to NotFoundException", async () => {
    const { pollController } = harness({
      startCreatePoll: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("maci not found"))),
    });

    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).rejects.toMatchObject({
      response: { error: "maci not found" },
    });
  });

  test("startCreatePoll maps an incomplete stand-up to BadRequestException", async () => {
    const { pollController } = harness({
      startCreatePoll: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("incomplete stand-up"))),
    });

    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).rejects.toMatchObject({
      response: { error: "incomplete stand-up" },
    });
  });

  test("startCreatePoll maps a busy job to ConflictException", async () => {
    const { pollController } = harness({
      startCreatePoll: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("busy"))),
    });

    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test("startCreatePoll maps a non-Error rejection to BadRequestException", async () => {
    const { pollController } = harness({
      startCreatePoll: vi.fn((): Promise<{ jobId: string }> =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- catch must map non-Errors to "failed"
        Promise.reject("boom"),
      ),
    });

    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pollController.startCreatePoll(request("Bearer jwt-token"), { address: MACI }, POLL_BODY),
    ).rejects.toMatchObject({
      response: { error: "failed" },
    });
  });

  test("startCreatePoll rejects a request without a Bearer token", async () => {
    const { pollController, startCreatePoll } = harness();

    await expect(pollController.startCreatePoll(request(), { address: MACI }, POLL_BODY)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(startCreatePoll).not.toHaveBeenCalled();
  });

  test("listPolls returns the page for an authenticated Operator", async () => {
    const items = [
      {
        address: "0xaa",
        pollId: "2",
        startDate: "0",
        endDate: "1000",
        pollPublicKey: ["0", "1"] as const,
        createdAtMs: 1_000_200,
      },
    ];
    const listPolls = vi.fn((): Promise<{ items: typeof items; total: number }> =>
      Promise.resolve({ items, total: 1 }),
    );
    const { pollController, authenticate } = harness({ listPolls });

    await expect(
      pollController.listPolls(request("Bearer jwt-token"), { address: MACI }, { page: "1", pageSize: "10" }),
    ).resolves.toEqual({
      items,
      total: 1,
      page: 1,
      pageSize: 10,
    });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
    expect(listPolls).toHaveBeenCalledWith(MACI, { page: 1, pageSize: 10 });
  });

  test("listPolls maps a missing MACI to NotFoundException", async () => {
    const { pollController } = harness({
      listPolls: vi.fn((): Promise<{ items: never[]; total: number }> => Promise.reject(new Error("maci not found"))),
    });

    await expect(pollController.listPolls(request("Bearer jwt-token"), { address: MACI }, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("listPolls rejects a request without a Bearer token", async () => {
    const { pollController, listPolls } = harness();

    await expect(pollController.listPolls(request(), { address: MACI }, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(listPolls).not.toHaveBeenCalled();
  });
});
