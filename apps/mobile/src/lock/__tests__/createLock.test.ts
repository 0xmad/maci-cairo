import { latestAppActivity, resetAppActivity, watchAppActivity } from "../../test/appActivity";
import {
  authenticationCallCount,
  finishAuthentication,
  holdAuthentication,
  queueAuthenticationResults,
  resetLocalAuthentication,
  setLocalAuthenticationEnrolledLevel,
} from "../../test/localAuthenticationState";
import { createLock } from "../createLock";

jest.mock("expo-local-authentication");

describe("createLock", () => {
  beforeEach(() => {
    resetAppActivity();
    resetLocalAuthentication();
    watchAppActivity();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the visit after the device authenticator succeeds", async () => {
    const lock = createLock();

    expect(lock.view()).toEqual({ status: "closed", reason: "prompting" });

    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "open" });
  });

  it("stays closed with only a retry after the prompt is dismissed", async () => {
    queueAuthenticationResults(["dismissed", "success"]);
    const lock = createLock();
    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "closed", reason: "dismissed" });

    await lock.foreground();

    expect(lock.view()).toEqual({ status: "open" });
  });

  it("stays closed when the device cannot authenticate and does not prompt", async () => {
    setLocalAuthenticationEnrolledLevel(0);
    const lock = createLock();
    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "closed", reason: "device-cannot-authenticate" });
    expect(authenticationCallCount()).toBe(0);
  });

  it("opens the visit when the system prompt marks the app inactive", async () => {
    holdAuthentication();
    const lock = createLock();
    lock.watch();

    await Promise.resolve();
    latestAppActivity()("inactive");
    finishAuthentication("success");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    latestAppActivity()("inactive");
    latestAppActivity()("active");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "open" });
    expect(authenticationCallCount()).toBe(1);
  });

  it("stays covered when the app leaves during the prompt", async () => {
    holdAuthentication();
    const lock = createLock();
    lock.watch();

    await Promise.resolve();
    latestAppActivity()("background");
    finishAuthentication("success");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "closed", reason: "prompting" });
  });

  it("prompts again only after the app leaves the foreground", async () => {
    queueAuthenticationResults(["success", "success"]);
    const lock = createLock();
    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "open" });
    expect(authenticationCallCount()).toBe(1);

    latestAppActivity()("active");
    latestAppActivity()("inactive");

    expect(lock.view()).toEqual({ status: "closed", reason: "prompting" });

    latestAppActivity()("active");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "open" });
    expect(authenticationCallCount()).toBe(2);
  });

  it("stays closed when the device authenticator fails", async () => {
    queueAuthenticationResults(["failed", "success"]);
    const lock = createLock();
    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "closed", reason: "dismissed" });

    await lock.foreground();

    expect(lock.view()).toEqual({ status: "open" });
  });

  it("ignores another leave while the visit is already covered", async () => {
    queueAuthenticationResults(["success", "success"]);
    const lock = createLock();
    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    latestAppActivity()("active");
    latestAppActivity()("inactive");
    latestAppActivity()("background");

    expect(lock.view()).toEqual({ status: "closed", reason: "prompting" });
    expect(authenticationCallCount()).toBe(1);

    latestAppActivity()("active");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "open" });
    expect(authenticationCallCount()).toBe(2);
  });

  it("stays closed when the prompt fails after the app returns", async () => {
    queueAuthenticationResults(["success", "failed"]);
    const lock = createLock();
    lock.watch();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "open" });

    latestAppActivity()("active");
    latestAppActivity()("inactive");
    latestAppActivity()("active");

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        resolve();
      });
    });

    expect(lock.view()).toEqual({ status: "closed", reason: "dismissed" });
  });
});
