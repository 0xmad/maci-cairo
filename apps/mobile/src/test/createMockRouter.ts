import { type useRouter } from "expo-router";

type AppRouter = ReturnType<typeof useRouter>;

interface MockRouterOverrides {
  push?: AppRouter["push"];
  replace?: AppRouter["replace"];
}

/** Full router stub for unit tests — no casts needed. */
export const createMockRouter = (overrides: MockRouterOverrides = {}): AppRouter => ({
  back: jest.fn(),
  canGoBack: () => false,
  push: overrides.push ?? jest.fn(),
  navigate: jest.fn(),
  replace: overrides.replace ?? jest.fn(),
  dismiss: jest.fn(),
  dismissTo: jest.fn(),
  dismissAll: jest.fn(),
  canDismiss: () => false,
  setParams: jest.fn(),
  reload: jest.fn(),
  prefetch: jest.fn(),
});
