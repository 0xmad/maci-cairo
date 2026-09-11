import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { describe, expect, test, vi } from "vitest";

import { type LoginService } from "../../login/services/login.service.js";
import { type CurrentMaci, type JobSnapshot } from "../repositories/job.store.js";
import { StandupController } from "../standup.controller.js";
import { type JobEvent, type StandupService } from "../standup.service.js";

const OPERATOR = "0x0000000000000000000000000000000000000000000000000000000000000001";

const MACI: CurrentMaci = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x9",
};

const STEP = { seq: 1, kind: "declare", name: "LeanIMT" };

const JOB: JobSnapshot = {
  id: "job-1",
  kind: "standup",
  status: "running",
  steps: [STEP],
};

function collectSse(
  observable: Observable<{ type?: string; data: JobEvent }>,
): Promise<{ type?: string; data: JobEvent }[]> {
  return new Promise((resolve, reject) => {
    const events: { type?: string; data: JobEvent }[] = [];

    observable.subscribe({
      next: (event: { type?: string; data: JobEvent }): void => {
        events.push(event);
      },
      error: reject,
      complete: (): void => {
        resolve(events);
      },
    });
  });
}

function harness(
  standupOverrides: Partial<StandupService> = {},
  loginOverrides: Partial<LoginService> = {},
): {
  standupController: StandupController;
  authenticate: ReturnType<typeof vi.fn>;
  startStandUp: ReturnType<typeof vi.fn>;
  currentMaci: ReturnType<typeof vi.fn>;
  currentJob: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
} {
  const authenticate = vi.fn((): Promise<string> => Promise.resolve(OPERATOR));
  const startStandUp = vi.fn((): Promise<{ jobId: string }> => Promise.resolve({ jobId: "job-1" }));
  const currentMaci = vi.fn((): Promise<CurrentMaci | undefined> => Promise.resolve(undefined));
  const currentJob = vi.fn((): Promise<JobSnapshot | undefined> => Promise.resolve(undefined));
  const subscribe = vi.fn((listener: (event: JobEvent) => void): Promise<() => void> => {
    listener({ type: "step", step: STEP });
    listener({ type: "completed", status: "succeeded" });

    return Promise.resolve((): void => undefined);
  });
  const loginService = { authenticate, ...loginOverrides } as unknown as LoginService;
  const standupService = {
    startStandUp,
    currentMaci,
    currentJob,
    subscribe,
    ...standupOverrides,
  } as unknown as StandupService;

  return {
    standupController: new StandupController(loginService, standupService),
    authenticate,
    startStandUp,
    currentMaci,
    currentJob,
    subscribe,
  };
}

function request(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as unknown as FastifyRequest;
}

describe("StandupController", () => {
  test("startStandUp returns the job id for an authenticated Operator", async () => {
    const { standupController, authenticate, startStandUp } = harness();

    await expect(standupController.startStandUp(request("Bearer jwt-token"))).resolves.toEqual({ jobId: "job-1" });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
    expect(startStandUp).toHaveBeenCalledOnce();
  });

  test("startStandUp rejects a request without a Bearer token", async () => {
    const { standupController, authenticate, startStandUp } = harness();

    await expect(standupController.startStandUp(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
    expect(startStandUp).not.toHaveBeenCalled();
  });

  test("startStandUp maps a busy job to ConflictException", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("busy"))),
    });

    await expect(standupController.startStandUp(request("Bearer jwt-token"))).rejects.toBeInstanceOf(ConflictException);
    await expect(standupController.startStandUp(request("Bearer jwt-token"))).rejects.toMatchObject({
      response: { error: "busy" },
    });
  });

  test("startStandUp rethrows other service errors", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("sncast failed"))),
    });

    await expect(standupController.startStandUp(request("Bearer jwt-token"))).rejects.toThrow(/^sncast failed$/u);
  });

  test("startStandUp maps a non-Error rejection to BadRequestException", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- catch must map non-Errors to "failed"
        Promise.reject("boom"),
      ),
    });

    await expect(standupController.startStandUp(request("Bearer jwt-token"))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(standupController.startStandUp(request("Bearer jwt-token"))).rejects.toMatchObject({
      response: { error: "failed" },
    });
  });

  test("readCurrentMaci returns null when no MACI is recorded", async () => {
    const { standupController } = harness();

    await expect(standupController.readCurrentMaci(request("Bearer jwt-token"))).resolves.toEqual({ maci: null });
  });

  test("readCurrentMaci returns the recorded MACI", async () => {
    const { standupController } = harness({
      currentMaci: vi.fn((): Promise<CurrentMaci | undefined> => Promise.resolve(MACI)),
    });

    await expect(standupController.readCurrentMaci(request("Bearer jwt-token"))).resolves.toEqual({ maci: MACI });
  });

  test("readCurrentJob returns null when no job exists", async () => {
    const { standupController } = harness();

    await expect(standupController.readCurrentJob(request("Bearer jwt-token"))).resolves.toEqual({ job: null });
  });

  test("readCurrentJob returns the latest job", async () => {
    const { standupController } = harness({
      currentJob: vi.fn((): Promise<JobSnapshot | undefined> => Promise.resolve(JOB)),
    });

    await expect(standupController.readCurrentJob(request("Bearer jwt-token"))).resolves.toEqual({ job: JOB });
  });

  test("subscribe emits SSE events then completes", async () => {
    const { standupController, subscribe } = harness();
    const stream = await standupController.subscribe(request("Bearer jwt-token"));

    await expect(collectSse(stream)).resolves.toEqual([
      { type: "step", data: { type: "step", step: STEP } },
      { type: "completed", data: { type: "completed", status: "succeeded" } },
    ]);
    expect(subscribe).toHaveBeenCalledOnce();
  });

  test("subscribe rejects a request without a Bearer token", async () => {
    const { standupController, subscribe } = harness();

    await expect(standupController.subscribe(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(subscribe).not.toHaveBeenCalled();
  });

  test("subscribe ignores events after the stream completes", async () => {
    const extra = { seq: 2, kind: "deploy", name: "leanImt" };
    const { standupController } = harness({
      subscribe: vi.fn((listener: (event: JobEvent) => void): Promise<() => void> => {
        listener({ type: "step", step: STEP });
        listener({ type: "completed", status: "succeeded" });
        listener({ type: "step", step: extra });

        return Promise.resolve((): void => undefined);
      }),
    });
    const stream = await standupController.subscribe(request("Bearer jwt-token"));

    await expect(collectSse(stream)).resolves.toEqual([
      { type: "step", data: { type: "step", step: STEP } },
      { type: "completed", data: { type: "completed", status: "succeeded" } },
    ]);
  });

  test("subscribe teardown swallows a failed service subscribe", async () => {
    let failSubscribe: ((error: Error) => void) | undefined;
    const { standupController } = harness({
      subscribe: vi.fn(
        (): Promise<() => void> =>
          new Promise((_resolve, reject) => {
            failSubscribe = reject;
          }),
      ),
    });
    const stream = await standupController.subscribe(request("Bearer jwt-token"));
    const subscription = stream.subscribe({
      next: (): void => undefined,
    });

    subscription.unsubscribe();
    failSubscribe?.(new Error("store down"));
    await Promise.resolve();
  });
});
