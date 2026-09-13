import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { type DeployMaciResult } from "maci-deploy/maci";
import { type Observable } from "rxjs";
import { describe, expect, test, vi } from "vitest";

import { type LoginService } from "../../login/services/login.service.js";
import { type Page } from "../../utils/pagination.js";
import { type JobSnapshot, type MaciListItem } from "../repositories/job.store.js";
import { StandupController } from "../standup.controller.js";
import { type JobEvent, type StandupService } from "../standup.service.js";

const OPERATOR = "0x0000000000000000000000000000000000000000000000000000000000000001";

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
  currentJob: ReturnType<typeof vi.fn>;
  listMacis: ReturnType<typeof vi.fn>;
  readMaci: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
} {
  const authenticate = vi.fn((): Promise<string> => Promise.resolve(OPERATOR));
  const startStandUp = vi.fn((): Promise<{ jobId: string }> => Promise.resolve({ jobId: "job-1" }));
  const currentJob = vi.fn((): Promise<JobSnapshot | undefined> => Promise.resolve(undefined));
  const listMacis = vi.fn((): Promise<Page<MaciListItem>> => Promise.resolve({ items: [], total: 0 }));
  const readMaci = vi.fn((): Promise<DeployMaciResult | undefined> => Promise.resolve(undefined));
  const subscribe = vi.fn((listener: (event: JobEvent) => void): Promise<() => void> => {
    listener({ type: "step", step: STEP });
    listener({ type: "completed", status: "succeeded" });

    return Promise.resolve((): void => undefined);
  });
  const loginService = { authenticate, ...loginOverrides } as unknown as LoginService;
  const standupService = {
    startStandUp,
    currentJob,
    listMacis,
    readMaci,
    subscribe,
    ...standupOverrides,
  } as unknown as StandupService;

  return {
    standupController: new StandupController(loginService, standupService),
    authenticate,
    startStandUp,
    currentJob,
    listMacis,
    readMaci,
    subscribe,
  };
}

function request(
  authorization?: string,
  query: Record<string, string> = {},
  params: Record<string, string> = {},
): FastifyRequest {
  return { headers: { authorization }, query, params } as unknown as FastifyRequest;
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

  test("listMacis returns a page of instances for an authenticated Operator", async () => {
    const listMacis = vi.fn((): Promise<Page<MaciListItem>> =>
      Promise.resolve({ items: [{ address: "0x7", network: "starknet_local" }], total: 1 }),
    );
    const { standupController } = harness({ listMacis });

    await expect(
      standupController.listMacis(request("Bearer jwt-token", { page: "2", pageSize: "1" })),
    ).resolves.toEqual({
      items: [{ address: "0x7", network: "starknet_local" }],
      total: 1,
      page: 2,
      pageSize: 1,
    });
    expect(listMacis).toHaveBeenCalledWith({ page: 2, pageSize: 1 });
  });

  test("listMacis defaults page and pageSize", async () => {
    const listMacis = vi.fn((): Promise<Page<MaciListItem>> => Promise.resolve({ items: [], total: 0 }));
    const { standupController } = harness({ listMacis });

    await expect(standupController.listMacis(request("Bearer jwt-token"))).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
    expect(listMacis).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  test("listMacis rejects a request without a Bearer token", async () => {
    const { standupController, listMacis } = harness();

    await expect(standupController.listMacis(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(listMacis).not.toHaveBeenCalled();
  });

  test("readMaci returns the instance for an authenticated Operator", async () => {
    const instance: DeployMaciResult = {
      leanImt: "0x1",
      checker: "0x2",
      enforcer: "0x3",
      assigner: "0x4",
      pollClassHash: "0x5",
      pollFactoryClassHash: "0x6",
      maci: "0x7",
      pollFactory: "0x8",
      coordinator: "0x9",
      deployer: "0xa",
      network: "starknet_local",
    };
    const readMaci = vi.fn((): Promise<DeployMaciResult | undefined> => Promise.resolve(instance));
    const { standupController } = harness({ readMaci });

    await expect(standupController.readMaci(request("Bearer jwt-token", {}, { address: "0x7" }))).resolves.toEqual(
      instance,
    );
    expect(readMaci).toHaveBeenCalledWith("0x7");
  });

  test("readMaci rejects a missing address", async () => {
    const { standupController, readMaci } = harness();

    await expect(standupController.readMaci(request("Bearer jwt-token"))).rejects.toBeInstanceOf(BadRequestException);
    await expect(standupController.readMaci(request("Bearer jwt-token"))).rejects.toMatchObject({
      response: { error: "maci address required" },
    });
    expect(readMaci).not.toHaveBeenCalled();
  });

  test("readMaci rejects an empty address", async () => {
    const { standupController, readMaci } = harness();

    await expect(standupController.readMaci(request("Bearer jwt-token", {}, { address: "" }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(readMaci).not.toHaveBeenCalled();
  });

  test("readMaci is not found when the instance is missing", async () => {
    const { standupController, readMaci } = harness();

    await expect(
      standupController.readMaci(request("Bearer jwt-token", {}, { address: "0x7" })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(readMaci).toHaveBeenCalledWith("0x7");
  });

  test("readMaci rejects a request without a Bearer token", async () => {
    const { standupController, readMaci } = harness();

    await expect(standupController.readMaci(request(undefined, {}, { address: "0x7" }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(readMaci).not.toHaveBeenCalled();
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
