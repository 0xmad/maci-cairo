import { UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { describe, expect, test, vi } from "vitest";

import { type LoginService } from "../../login/services/login.service.js";
import { type StandupService } from "../../standup/standup.service.js";
import { type MaciInstanceRecord } from "../../standup/standup.store.js";
import { type JobEvent, type JobEvents } from "../job.events.js";
import { type JobSnapshot, type JobStore } from "../job.store.js";
import { JobsController } from "../jobs.controller.js";

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
  jobOverrides: Partial<JobStore> = {},
  standupOverrides: Partial<StandupService> = {},
  eventOverrides: Partial<JobEvents> = {},
) {
  const authenticate = vi.fn((): Promise<string> => Promise.resolve(OPERATOR));
  const latest = vi.fn((): Promise<JobSnapshot | undefined> => Promise.resolve(undefined));
  const hasIncompleteStandUp = vi.fn((): Promise<boolean> => Promise.resolve(false));
  const currentMaciInstance = vi.fn((): Promise<MaciInstanceRecord | undefined> => Promise.resolve(undefined));
  const subscribe = vi.fn((_job: JobSnapshot | undefined, listener: (event: JobEvent) => void): (() => void) => {
    listener({ type: "step", step: STEP });
    listener({ type: "completed", status: "succeeded" });

    return (): void => undefined;
  });
  const loginService = { authenticate } as unknown as LoginService;
  const jobs = { latest, ...jobOverrides } as unknown as JobStore;
  const events = { subscribe, ...eventOverrides } as unknown as JobEvents;
  const standupService = {
    hasIncompleteStandUp,
    currentMaciInstance,
    ...standupOverrides,
  } as unknown as StandupService;

  return {
    jobsController: new JobsController(loginService, jobs, events, standupService),
    authenticate,
    latest,
    hasIncompleteStandUp,
    currentMaciInstance,
    subscribe,
  };
}

function request(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as unknown as FastifyRequest;
}

describe("JobsController", () => {
  test("readCurrentJob returns null when no job exists", async () => {
    const { jobsController } = harness();

    await expect(jobsController.readCurrentJob(request("Bearer jwt-token"))).resolves.toEqual({
      job: null,
      incompleteStandUp: false,
      currentMaci: null,
    });
  });

  test("readCurrentJob returns the latest job and incomplete stand-up", async () => {
    const { jobsController } = harness(
      { latest: vi.fn((): Promise<JobSnapshot | undefined> => Promise.resolve(JOB)) },
      { hasIncompleteStandUp: vi.fn((): Promise<boolean> => Promise.resolve(true)) },
    );

    await expect(jobsController.readCurrentJob(request("Bearer jwt-token"))).resolves.toEqual({
      job: JOB,
      incompleteStandUp: true,
      currentMaci: null,
    });
  });

  test("readCurrentJob includes current MACI", async () => {
    const { jobsController } = harness(
      {},
      {
        currentMaciInstance: vi.fn((): Promise<MaciInstanceRecord | undefined> =>
          Promise.resolve({
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
            circuitProfile: "small",
            policy: "Free for all",
            voteBalanceAssigner: "Constant vote balance",
          }),
        ),
      },
    );

    await expect(jobsController.readCurrentJob(request("Bearer jwt-token"))).resolves.toMatchObject({
      currentMaci: "0x7",
    });
  });

  test("subscribe emits SSE events then completes", async () => {
    const { jobsController, subscribe } = harness();
    const stream = await jobsController.subscribe(request("Bearer jwt-token"));

    await expect(collectSse(stream)).resolves.toEqual([
      { type: "step", data: { type: "step", step: STEP } },
      { type: "completed", data: { type: "completed", status: "succeeded" } },
    ]);
    expect(subscribe).toHaveBeenCalledOnce();
  });

  test("subscribe rejects a request without a Bearer token", async () => {
    const { jobsController, subscribe } = harness();

    await expect(jobsController.subscribe(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(subscribe).not.toHaveBeenCalled();
  });

  test("subscribe ignores events after the stream completes", async () => {
    const extra = { seq: 2, kind: "deploy", name: "leanImt" };
    const { jobsController } = harness(
      {},
      {},
      {
        subscribe: vi.fn((_job: JobSnapshot | undefined, listener: (event: JobEvent) => void): (() => void) => {
          listener({ type: "step", step: STEP });
          listener({ type: "completed", status: "succeeded" });
          listener({ type: "step", step: extra });

          return (): void => undefined;
        }),
      },
    );
    const stream = await jobsController.subscribe(request("Bearer jwt-token"));

    await expect(collectSse(stream)).resolves.toEqual([
      { type: "step", data: { type: "step", step: STEP } },
      { type: "completed", data: { type: "completed", status: "succeeded" } },
    ]);
  });
});
