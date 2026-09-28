import { fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import HomeRoute from "..";
import { defaultUnboundUserKeys } from "../../keys/defaultUnboundUserKeys";
import { fixedPublicKey, fixedRecord } from "../../keys/testFixtures";
import { formatUserPublicKeyPreview } from "../../keys/unboundUserKey";
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

describe("app routes", () => {
  beforeEach(() => {
    load.mockReset();
  });

  it("shows Set up keys when no unbound key exists", async () => {
    load.mockResolvedValue(null);

    await renderRouter({
      _layout: Layout,
      index: HomeRoute,
      keys: KeysRoute,
    });

    expect(await screen.findByText("Voter client")).toBeOnTheScreen();
    expect(screen.getByText("Stub. Signup and Ballot are not in this slice.")).toBeOnTheScreen();
    expect(screen.getByRole("link", { name: "Set up keys" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Settings" })).toBeOnTheScreen();
  });

  it("hides Set up keys and navigates to keys from the settings menu when an unbound key exists", async () => {
    load.mockResolvedValue(fixedRecord);

    await renderRouter({
      _layout: Layout,
      index: HomeRoute,
      keys: KeysRoute,
    });

    expect(await screen.findByRole("button", { name: "Settings" })).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: "Set up keys" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByLabelText("Keys")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Keys"));

    expect(
      await screen.findByText(
        "Your public key is ready. It is not bound to a MACI yet - you will use it when you sign up.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
  });
});
