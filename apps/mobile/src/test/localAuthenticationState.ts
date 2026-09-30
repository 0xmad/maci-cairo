const enrolled = { level: 1 };
type AuthenticationOutcome = "success" | "dismissed" | "failed";

const authentication = {
  calls: 0,
  results: undefined as AuthenticationOutcome[] | undefined,
  hold: false,
  finish: undefined as ((result: "success" | "dismissed") => void) | undefined,
};

export const setLocalAuthenticationEnrolledLevel = (level: number): void => {
  enrolled.level = level;
};

export const localAuthenticationEnrolledLevel = (): number => enrolled.level;

export const resetLocalAuthentication = (): void => {
  enrolled.level = 1;
  authentication.calls = 0;
  authentication.results = undefined;
  authentication.hold = false;
  authentication.finish = undefined;
};

export const queueAuthenticationResults = (results: AuthenticationOutcome[]): void => {
  authentication.results = [...results];
  authentication.calls = 0;
  authentication.hold = false;
};

export const authenticationCallCount = (): number => authentication.calls;

export const holdAuthentication = (): void => {
  authentication.hold = true;
  authentication.results = undefined;
  authentication.calls = 0;
};

export const finishAuthentication = (result: "success" | "dismissed"): void => {
  authentication.finish?.(result);
  authentication.finish = undefined;
  authentication.hold = false;
};

export const takeAuthenticationResult = (): Promise<"success" | "dismissed"> => {
  authentication.calls += 1;

  if (authentication.hold) {
    return new Promise((resolve) => {
      authentication.finish = resolve;
    });
  }

  const result = authentication.results?.shift();

  if (result === "failed") {
    return Promise.reject(new Error("authentication failed"));
  }

  if (authentication.results !== undefined && result === undefined) {
    return Promise.reject(new Error("unexpected authenticate"));
  }

  return Promise.resolve(result ?? "success");
};
