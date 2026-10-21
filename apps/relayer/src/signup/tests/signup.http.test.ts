import { afterEach, describe, expect, test } from "vitest";

import { type ChainEvent, type PaidCall, type PaidInvocation, type RelayerAccount } from "../../account/types.js";
import { createServer, type RunningServer } from "../../server.js";
import { SIGNUP_EVENT_SELECTOR } from "../utils/signUpCall.js";

const RELAYER = "0x11";
const MACI = "0xabc";

class RecordingAccount implements RelayerAccount {
  readonly address = RELAYER;

  readonly calls: PaidCall[] = [];

  invokeAndPay(call: PaidCall): Promise<PaidInvocation> {
    this.calls.push(call);

    return Promise.resolve({
      transactionHash: "0x71",
      sender: this.address,
      feeAmount: "0x64",
      paymasterData: [],
      events: [signupEvent(["0x1", "0x0", "0x2", "0x0"])],
    });
  }
}

class ChainSignupAccount implements RelayerAccount {
  readonly address = RELAYER;

  readonly calls: PaidCall[] = [];

  readonly events: string[][] = [];

  private readonly signedUp = new Set<string>();

  invokeAndPay(call: PaidCall): Promise<PaidInvocation> {
    this.calls.push(call);
    const submittedPublicKey = call.calldata.join(",");

    if (this.signedUp.has(submittedPublicKey)) {
      return Promise.resolve({
        transactionHash: "0xrejected",
        sender: this.address,
        feeAmount: "0x64",
        paymasterData: [],
        events: [],
        revertReason: "Public key already signed up",
      });
    }

    this.signedUp.add(submittedPublicKey);
    this.events.push(submittedUserPublicKeyLimbs(call));

    return Promise.resolve({
      transactionHash: `0x${this.calls.length.toString(16)}`,
      sender: this.address,
      feeAmount: "0x64",
      paymasterData: [],
      events: [signupEvent(submittedUserPublicKeyLimbs(call))],
    });
  }
}

function signupEvent(limbs: string[]): ChainEvent {
  return {
    fromAddress: MACI,
    keys: [SIGNUP_EVENT_SELECTOR, ...limbs],
    data: [],
  };
}

function submittedUserPublicKeyLimbs(call: PaidCall): string[] {
  return call.calldata.slice(0, 4);
}

function postSignup(port: number, body: Record<string, unknown> = {}): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userPublicKey: { x: "1", y: "2" },
      evidence: "",
      maci: MACI,
      ...body,
    }),
  });
}

describe("POST /signup", () => {
  let server: RunningServer | undefined;

  afterEach(async () => {
    if (server !== undefined) {
      await server.close();
    }

    server = undefined;
  });

  test("submits the user public key, empty Evidence, and the MACI from the Relayer account", async () => {
    const account = new RecordingAccount();
    server = await createServer(0, account);
    const res = await postSignup(server.port);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ transactionHash: "0x71" });
    expect(account.calls).toEqual([
      {
        contractAddress: MACI,
        entrypoint: "sign_up",
        calldata: ["1", "0", "2", "0", "0", "0", "0"],
      },
    ]);
  });

  test("rejects a body that carries the user private key", async () => {
    const account = new RecordingAccount();
    server = await createServer(0, account);
    const res = await postSignup(server.port, { userPrivateKey: "7" });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid request",
    });
    expect(account.calls).toEqual([]);
  });

  test("rejects a body that carries a Stark key", async () => {
    const account = new RecordingAccount();
    server = await createServer(0, account);
    const res = await postSignup(server.port, { userPublicKey: { x: "1", y: "2", starkKey: "0x1" } });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid request",
    });
    expect(account.calls).toEqual([]);
  });

  test("rejects Evidence that is not empty", async () => {
    const account = new RecordingAccount();
    server = await createServer(0, account);
    const res = await postSignup(server.port, { evidence: "subject" });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid request",
    });
    expect(account.calls).toEqual([]);
  });

  test("accepts two distinct user public keys from the one Relayer account", async () => {
    const account = new ChainSignupAccount();
    server = await createServer(0, account);
    const first = await postSignup(server.port);
    const second = await postSignup(server.port, {
      userPublicKey: {
        x: "1606938044258990275541962092341162602522202993782792835301379",
        y: "2",
      },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ transactionHash: "0x1" });
    await expect(second.json()).resolves.toEqual({ transactionHash: "0x2" });
    expect(account.calls.map((call) => call.calldata)).toEqual([
      ["1", "0", "2", "0", "0", "0", "0"],
      ["3", "4722366482869645213696", "2", "0", "0", "0", "0"],
    ]);
    expect(account.events).toEqual([
      ["1", "0", "2", "0"],
      ["3", "4722366482869645213696", "2", "0"],
    ]);
  });

  test("rejects a user public key that already has a state-tree leaf", async () => {
    const account = new ChainSignupAccount();
    server = await createServer(0, account);
    const first = await postSignup(server.port);
    const repeat = await postSignup(server.port);

    expect(first.status).toBe(200);
    expect(repeat.status).toBe(409);
    await expect(repeat.json()).resolves.toEqual({ error: "Public key already signed up" });
    expect(account.events).toEqual([["1", "0", "2", "0"]]);
  });
});
