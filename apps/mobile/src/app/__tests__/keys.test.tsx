import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import HomeRoute from "..";
import { defaultUnboundUserKeys } from "../../keys/defaultUnboundUserKeys";
import Layout from "../_layout";
import KeysRoute from "../keys";

jest.mock("../../keys/defaultUnboundUserKeys", () => ({
  defaultUnboundUserKeys: {
    load: jest.fn(),
    create: jest.fn(),
    clear: jest.fn(),
  },
}));

const load = jest.mocked(defaultUnboundUserKeys.load);

describe("keys route", () => {
  beforeEach(() => {
    load.mockReset();
    load.mockResolvedValue(null);
  });

  it("shows the Keys screen at /keys", async () => {
    await renderRouter(
      {
        _layout: Layout,
        index: HomeRoute,
        keys: KeysRoute,
      },
      { initialUrl: "/keys" },
    );

    expect(await screen.findByText("Create user private key")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("navigates home when Back is pressed", async () => {
    await renderRouter(
      {
        _layout: Layout,
        index: HomeRoute,
        keys: KeysRoute,
      },
      { initialUrl: "/keys" },
    );

    expect(await screen.findByRole("button", { name: "Back" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Voter client")).toBeOnTheScreen();
    expect(screen.getByText("Stub. Signup and Ballot are not in this slice.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
