import { act, fireEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import HomeRoute from "..";
import {
  authenticationCallCount,
  queueAuthenticationResults,
  setLocalAuthenticationEnrolledLevel,
} from "../../test/localAuthenticationState";
import Layout from "../_layout";
import KeysRoute from "../keys";

jest.mock("expo-local-authentication");

jest.mock("../../keys/defaultUnboundUserKeys", () => ({
  defaultUnboundUserKeys: {
    load: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(),
    clear: jest.fn(),
  },
}));

describe("lock route", () => {
  it("shows none of the client when the device cannot authenticate", async () => {
    setLocalAuthenticationEnrolledLevel(0);

    await renderRouter({
      _layout: Layout,
      index: HomeRoute,
      keys: KeysRoute,
    });

    expect(await screen.findByText("Set a device passcode or biometrics to use the voter client.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeOnTheScreen();
    expect(screen.queryByText("Voter client")).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("opens Home and Keys for the rest of the visit without a second prompt", async () => {
    setLocalAuthenticationEnrolledLevel(1);
    queueAuthenticationResults(["success"]);

    await renderRouter({
      _layout: Layout,
      index: HomeRoute,
      keys: KeysRoute,
    });

    expect(await screen.findByRole("link", { name: "Set up keys" })).toBeOnTheScreen();
    expect(authenticationCallCount()).toBe(1);

    await act(async () => {
      fireEvent.press(screen.getByRole("link", { name: "Set up keys" }));
      await Promise.resolve();
    });

    expect(await screen.findByText("Create user private key")).toBeOnTheScreen();
    expect(authenticationCallCount()).toBe(1);
  });
});
