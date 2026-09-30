import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { LockGate } from "../LockGate";

describe("LockGate", () => {
  it("shows none of the client while the prompt is up", async () => {
    await render(
      <LockGate view={{ status: "closed", reason: "prompting" }} onRetry={jest.fn()}>
        <Text>Voter client</Text>
      </LockGate>,
    );

    expect(screen.queryByText("Voter client")).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlock" })).toBeNull();
  });

  it("shows only Unlock after the prompt is dismissed", async () => {
    const onRetry = jest.fn();

    await render(
      <LockGate view={{ status: "closed", reason: "dismissed" }} onRetry={onRetry}>
        <Text>Voter client</Text>
      </LockGate>,
    );

    expect(screen.queryByText("Voter client")).toBeNull();
    expect(screen.queryByText("Set a device passcode or biometrics to use the voter client.")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Unlock" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("stays closed with an explanation when the device cannot authenticate", async () => {
    await render(
      <LockGate view={{ status: "closed", reason: "device-cannot-authenticate" }} onRetry={jest.fn()}>
        <Text>Create user private key</Text>
      </LockGate>,
    );

    expect(screen.getByText("Set a device passcode or biometrics to use the voter client.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeOnTheScreen();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("shows the client when the visit is open", async () => {
    await render(
      <LockGate view={{ status: "open" }} onRetry={jest.fn()}>
        <Text>Voter client</Text>
      </LockGate>,
    );

    expect(screen.getByText("Voter client")).toBeOnTheScreen();
  });
});
