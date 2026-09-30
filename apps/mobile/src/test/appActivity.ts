import { AppState, type AppStateStatus } from "react-native";

const activityListeners: ((next: AppStateStatus) => void)[] = [];

export const resetAppActivity = (): void => {
  activityListeners.length = 0;
};

export const watchAppActivity = (): void => {
  jest.spyOn(AppState, "addEventListener").mockImplementation((type, listener) => {
    if (type === "change") {
      activityListeners.push(listener);
    }

    return { remove: jest.fn() };
  });
};

export const latestAppActivity = (): ((next: AppStateStatus) => void) => {
  const listener = activityListeners.at(-1);

  if (listener === undefined) {
    throw new Error("lock did not watch app activity");
  }

  return listener;
};
