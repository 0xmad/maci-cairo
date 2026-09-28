import { fireEvent, render, screen } from "@testing-library/react-native";
import { usePathname, useRouter } from "expo-router";

import { AppHeader } from "..";
import { createMockRouter } from "../../../test/createMockRouter";

jest.mock("expo-router", () => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return -- jest mock factory */
  const actual = jest.requireActual("expo-router");

  return {
    ...actual,
    usePathname: jest.fn(),
    useRouter: jest.fn(),
  };
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
});

const usePathnameMock = jest.mocked(usePathname);
const useRouterMock = jest.mocked(useRouter);

describe("AppHeader", () => {
  const push = jest.fn();

  beforeEach(() => {
    push.mockReset();
    usePathnameMock.mockReturnValue("/");
    useRouterMock.mockReturnValue(createMockRouter({ push }));
  });

  it("shows the home title with Settings", async () => {
    await render(<AppHeader />);

    expect(screen.getByText("Voter client")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Settings" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("links to the keys page from the settings menu", async () => {
    await render(<AppHeader />);

    expect(screen.getByRole("button", { name: "Settings" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByTestId("settings-keys-link")).toBeOnTheScreen();
    expect(screen.getByLabelText("Keys")).toBeOnTheScreen();
  });

  it("keeps the keys link when already on the keys page", async () => {
    usePathnameMock.mockReturnValue("/keys");

    await render(<AppHeader />);

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByTestId("settings-keys-link")).toBeOnTheScreen();
    expect(screen.getByLabelText("Keys")).toBeOnTheScreen();
  });

  it("dismisses the settings menu from the backdrop", async () => {
    await render(<AppHeader />);

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByLabelText("Keys")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("settings-menu-backdrop"));

    expect(screen.queryByLabelText("Keys")).toBeNull();
  });

  it("navigates home when Back is pressed on the keys route", async () => {
    usePathnameMock.mockReturnValue("/keys");

    await render(<AppHeader />);

    expect(screen.getByText("Keys")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
