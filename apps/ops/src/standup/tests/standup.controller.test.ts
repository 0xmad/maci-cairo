import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { type FastifyRequest } from "fastify";
import { describe, expect, test, vi } from "vitest";

import { type LoginService } from "../../login/services/login.service.js";
import { type Page } from "../../utils/pagination.js";
import { type ListMacisQueryDto } from "../dto/listMacis.dto.js";
import { type ReadMaciParamsDto } from "../dto/readMaci.dto.js";
import { type StartStandUpDto } from "../dto/startStandUp.dto.js";
import { StandupController } from "../standup.controller.js";
import { type StandUpCatalog, type StandupService } from "../standup.service.js";
import { type MaciInstanceRecord, type MaciListItem } from "../standup.store.js";

const OPERATOR = "0x0000000000000000000000000000000000000000000000000000000000000001";

const STANDUP_BODY = {
  circuitProfile: "small",
  policy: "Free for all",
  assigner: "Constant vote balance",
};

function harness(
  standupOverrides: Partial<StandupService> = {},
  loginOverrides: Partial<LoginService> = {},
): {
  standupController: StandupController;
  authenticate: ReturnType<typeof vi.fn>;
  startStandUp: ReturnType<typeof vi.fn>;
  readStandUpCatalog: ReturnType<typeof vi.fn>;
  listMacis: ReturnType<typeof vi.fn>;
  readMaci: ReturnType<typeof vi.fn>;
  discardStandUp: ReturnType<typeof vi.fn>;
} {
  const authenticate = vi.fn((): Promise<string> => Promise.resolve(OPERATOR));
  const startStandUp = vi.fn((): Promise<{ jobId: string }> => Promise.resolve({ jobId: "job-1" }));
  const readStandUpCatalog = vi.fn((): StandUpCatalog => ({
    circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
    policies: [{ id: "Free for all" }],
    assigners: [{ id: "Constant vote balance" }],
  }));
  const listMacis = vi.fn((): Promise<Page<MaciListItem>> => Promise.resolve({ items: [], total: 0 }));
  const readMaci = vi.fn((): Promise<MaciInstanceRecord | undefined> => Promise.resolve(undefined));
  const discardStandUp = vi.fn((): Promise<void> => Promise.resolve());
  const loginService = { authenticate, ...loginOverrides } as unknown as LoginService;
  const standupService = {
    startStandUp,
    readStandUpCatalog,
    listMacis,
    readMaci,
    discardStandUp,
    ...standupOverrides,
  } as unknown as StandupService;

  return {
    standupController: new StandupController(loginService, standupService),
    authenticate,
    startStandUp,
    readStandUpCatalog,
    listMacis,
    readMaci,
    discardStandUp,
  };
}

function request(
  authorization?: string,
  query: Record<string, string> = {},
  params: Record<string, string> = {},
): FastifyRequest {
  return { headers: { authorization }, query, params } as unknown as FastifyRequest;
}

function standupBody(body: unknown): StartStandUpDto {
  return body as StartStandUpDto;
}

function listMacisQuery(query: unknown): ListMacisQueryDto {
  return query as ListMacisQueryDto;
}

function readMaciParams(params: unknown): ReadMaciParamsDto {
  return params as ReadMaciParamsDto;
}

describe("StandupController", () => {
  test("readStandUpCatalog returns the catalog for an authenticated Operator", async () => {
    const { standupController, authenticate, readStandUpCatalog } = harness();

    await expect(standupController.readStandUpCatalog(request("Bearer jwt-token"))).resolves.toEqual({
      circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
      policies: [{ id: "Free for all" }],
      assigners: [{ id: "Constant vote balance" }],
    });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
    expect(readStandUpCatalog).toHaveBeenCalledOnce();
  });

  test("readStandUpCatalog rejects a request without a Bearer token", async () => {
    const { standupController, authenticate, readStandUpCatalog } = harness();

    await expect(standupController.readStandUpCatalog(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
    expect(readStandUpCatalog).not.toHaveBeenCalled();
  });

  test("startStandUp returns the job id for an authenticated Operator", async () => {
    const { standupController, authenticate, startStandUp } = harness();

    await expect(standupController.startStandUp(request("Bearer jwt-token"), STANDUP_BODY)).resolves.toEqual({
      jobId: "job-1",
    });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
    expect(startStandUp).toHaveBeenCalledWith({
      circuitProfile: "small",
      policy: "Free for all",
      assigner: "Constant vote balance",
    });
  });

  test("startStandUp rejects an empty body", async () => {
    const { standupController, startStandUp } = harness();

    await expect(
      standupController.startStandUp(request("Bearer jwt-token"), standupBody(undefined)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(standupController.startStandUp(request("Bearer jwt-token"), standupBody({}))).rejects.toMatchObject({
      response: { error: "circuitProfile, policy, and assigner required" },
    });
    expect(startStandUp).not.toHaveBeenCalled();
  });

  test("startStandUp does not mention Checker or Enforcer in the body error", async () => {
    const { standupController } = harness();

    await expect(standupController.startStandUp(request("Bearer jwt-token"), standupBody({}))).rejects.toMatchObject({
      response: { error: "circuitProfile, policy, and assigner required" },
    });
  });

  test("startStandUp rejects extra fields on the body", async () => {
    const { standupController, startStandUp } = harness();

    await expect(
      standupController.startStandUp(request("Bearer jwt-token"), standupBody({ ...STANDUP_BODY, checker: "0x1" })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(startStandUp).not.toHaveBeenCalled();
  });

  test("startStandUp rejects a request without a Bearer token", async () => {
    const { standupController, authenticate, startStandUp } = harness();

    await expect(standupController.startStandUp(request(), STANDUP_BODY)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticate).not.toHaveBeenCalled();
    expect(startStandUp).not.toHaveBeenCalled();
  });

  test("startStandUp maps a busy job to ConflictException", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("busy"))),
    });

    await expect(standupController.startStandUp(request("Bearer jwt-token"), STANDUP_BODY)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(standupController.startStandUp(request("Bearer jwt-token"), STANDUP_BODY)).rejects.toMatchObject({
      response: { error: "busy" },
    });
  });

  test("startStandUp rethrows other service errors", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("sncast failed"))),
    });

    await expect(standupController.startStandUp(request("Bearer jwt-token"), STANDUP_BODY)).rejects.toThrow(
      /^sncast failed$/u,
    );
  });

  test("startStandUp maps a non-Error rejection to BadRequestException", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> =>
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- catch must map non-Errors to "failed"
        Promise.reject("boom"),
      ),
    });

    await expect(standupController.startStandUp(request("Bearer jwt-token"), STANDUP_BODY)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(standupController.startStandUp(request("Bearer jwt-token"), STANDUP_BODY)).rejects.toMatchObject({
      response: { error: "failed" },
    });
  });

  test("startStandUp maps an unknown Circuit profile to BadRequestException", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> =>
        Promise.reject(new Error("unknown circuit profile: medium")),
      ),
    });

    await expect(
      standupController.startStandUp(request("Bearer jwt-token"), { ...STANDUP_BODY, circuitProfile: "medium" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      standupController.startStandUp(request("Bearer jwt-token"), { ...STANDUP_BODY, circuitProfile: "medium" }),
    ).rejects.toMatchObject({
      response: { error: "unknown circuit profile: medium" },
    });
  });

  test("startStandUp maps an illegal vote balance to BadRequestException", async () => {
    const { standupController } = harness({
      startStandUp: vi.fn((): Promise<{ jobId: string }> => Promise.reject(new Error("Zero vote balance"))),
    });

    await expect(
      standupController.startStandUp(request("Bearer jwt-token"), { ...STANDUP_BODY, voteBalance: 0 }),
    ).rejects.toMatchObject({
      response: { error: "Zero vote balance" },
    });
  });

  test("startStandUp passes voteBalance as constantVoteBalance", async () => {
    const { standupController, startStandUp } = harness();

    await expect(
      standupController.startStandUp(request("Bearer jwt-token"), { ...STANDUP_BODY, voteBalance: 7 }),
    ).resolves.toEqual({ jobId: "job-1" });
    expect(startStandUp).toHaveBeenCalledWith({
      circuitProfile: "small",
      policy: "Free for all",
      assigner: "Constant vote balance",
      constantVoteBalance: 7n,
    });
  });

  test("listMacis returns a page of instances for an authenticated Operator", async () => {
    const listMacis = vi.fn((): Promise<Page<MaciListItem>> =>
      Promise.resolve({ items: [{ address: "0x7", network: "starknet_local", createdAtMs: 1_000_100 }], total: 1 }),
    );
    const { standupController } = harness({ listMacis });

    await expect(
      standupController.listMacis(request("Bearer jwt-token"), listMacisQuery({ page: "2", pageSize: "1" })),
    ).resolves.toEqual({
      items: [{ address: "0x7", network: "starknet_local", createdAtMs: 1_000_100 }],
      total: 1,
      page: 2,
      pageSize: 1,
    });
    expect(listMacis).toHaveBeenCalledWith({ page: 2, pageSize: 1 });
  });

  test("listMacis defaults page and pageSize", async () => {
    const listMacis = vi.fn((): Promise<Page<MaciListItem>> => Promise.resolve({ items: [], total: 0 }));
    const { standupController } = harness({ listMacis });

    await expect(standupController.listMacis(request("Bearer jwt-token"), listMacisQuery(undefined))).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
    expect(listMacis).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  test("listMacis rejects a request without a Bearer token", async () => {
    const { standupController, listMacis } = harness();

    await expect(standupController.listMacis(request(), listMacisQuery(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(listMacis).not.toHaveBeenCalled();
  });

  test("readMaci returns the instance for an authenticated Operator", async () => {
    const instance: MaciInstanceRecord = {
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
    };
    const readMaci = vi.fn((): Promise<MaciInstanceRecord | undefined> => Promise.resolve(instance));
    const { standupController } = harness({ readMaci });

    await expect(
      standupController.readMaci(request("Bearer jwt-token"), readMaciParams({ address: "0x7" })),
    ).resolves.toEqual(instance);
    expect(readMaci).toHaveBeenCalledWith("0x7");
  });

  test("readMaci rejects a missing address", async () => {
    const { standupController, readMaci } = harness();

    await expect(
      standupController.readMaci(request("Bearer jwt-token"), readMaciParams(undefined)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(standupController.readMaci(request("Bearer jwt-token"), readMaciParams({}))).rejects.toMatchObject({
      response: { error: "maci address required" },
    });
    expect(readMaci).not.toHaveBeenCalled();
  });

  test("readMaci rejects an empty address", async () => {
    const { standupController, readMaci } = harness();

    await expect(
      standupController.readMaci(request("Bearer jwt-token"), readMaciParams({ address: "" })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(readMaci).not.toHaveBeenCalled();
  });

  test("readMaci is not found when the instance is missing", async () => {
    const { standupController, readMaci } = harness();

    await expect(
      standupController.readMaci(request("Bearer jwt-token"), readMaciParams({ address: "0x7" })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(readMaci).toHaveBeenCalledWith("0x7");
  });

  test("readMaci rejects a request without a Bearer token", async () => {
    const { standupController, readMaci } = harness();

    await expect(
      standupController.readMaci(request(undefined, {}, { address: "0x7" }), readMaciParams({ address: "0x7" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(readMaci).not.toHaveBeenCalled();
  });

  test("discardStandUp discards for an authenticated Operator", async () => {
    const { standupController, authenticate, discardStandUp } = harness();

    await expect(standupController.discardStandUp(request("Bearer jwt-token"))).resolves.toEqual({ discarded: true });
    expect(authenticate).toHaveBeenCalledWith("jwt-token");
    expect(discardStandUp).toHaveBeenCalledOnce();
  });

  test("discardStandUp maps a running job to ConflictException", async () => {
    const { standupController } = harness({
      discardStandUp: vi.fn((): Promise<void> => Promise.reject(new Error("busy"))),
    });

    await expect(standupController.discardStandUp(request("Bearer jwt-token"))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  test("discardStandUp rejects a request without a Bearer token", async () => {
    const { standupController, discardStandUp } = harness();

    await expect(standupController.discardStandUp(request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(discardStandUp).not.toHaveBeenCalled();
  });
});
