import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ExpoClipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { KeysPage } from "..";
import { defaultUnboundUserKeys } from "../../../keys/defaultUnboundUserKeys";
import { fixedPublicKey, fixedRecord } from "../../../keys/testFixtures";
import { formatUserPublicKeyPreview, serializeUserPublicKey } from "../../../keys/unboundUserKey";
import { createMockRouter } from "../../../test/createMockRouter";
import { showKeysDebugControls } from "../showKeysDebugControls";

jest.mock("../../../keys/defaultUnboundUserKeys", () => ({
  defaultUnboundUserKeys: {
    load: jest.fn(),
    create: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("react-native-toast-message", () => {
  const show = jest.fn();

  return {
    __esModule: true,
    default: Object.assign(() => null, { show, hide: jest.fn() }),
  };
});

jest.mock("../showKeysDebugControls", () => ({
  showKeysDebugControls: jest.fn(() => true),
}));

const load = jest.mocked(defaultUnboundUserKeys.load);
const create = jest.mocked(defaultUnboundUserKeys.create);
const clear = jest.mocked(defaultUnboundUserKeys.clear);
const setStringAsync = jest.mocked(ExpoClipboard.setStringAsync);
const showToast = jest.mocked(Toast.show);
const showKeysDebugControlsMock = jest.mocked(showKeysDebugControls);
const useRouterMock = jest.mocked(useRouter);

describe("Keys page", () => {
  beforeEach(() => {
    load.mockReset();
    create.mockReset();
    clear.mockReset();
    setStringAsync.mockReset();
    showToast.mockReset();
    showKeysDebugControlsMock.mockReset();
    showKeysDebugControlsMock.mockReturnValue(true);
    useRouterMock.mockReturnValue(createMockRouter());
  });

  it("creates an unbound user private key from the CTA", async () => {
    load.mockResolvedValue(null);
    create.mockResolvedValue(fixedRecord);

    await render(<KeysPage />);

    expect(
      await screen.findByText("Create a user private key for voting. It is stored securely on this device."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Create user private key")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Create user private key" }));

    expect(await screen.findByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
    expect(
      screen.getByText("Your public key is ready. It is not bound to a MACI yet - you will use it when you sign up."),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("shows an existing unbound key without offering create again", async () => {
    load.mockResolvedValue(fixedRecord);

    await render(<KeysPage />);

    expect(await screen.findByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
    expect(
      screen.getByText("Your public key is ready. It is not bound to a MACI yet - you will use it when you sign up."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Copy public key" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Clear unbound key" })).toBeOnTheScreen();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("hides the clear control outside development", async () => {
    showKeysDebugControlsMock.mockReturnValue(false);
    load.mockResolvedValue(fixedRecord);

    await render(<KeysPage />);

    expect(await screen.findByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Clear unbound key" })).toBeNull();
  });

  it("clears the unbound key from the debug control", async () => {
    load.mockResolvedValue(fixedRecord);
    clear.mockResolvedValue(undefined);

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Clear unbound key" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear unbound key" }));

    await waitFor(() => {
      expect(clear).toHaveBeenCalled();
    });
  });

  it("shows an error when clear fails", async () => {
    load.mockResolvedValue(fixedRecord);
    clear.mockRejectedValue(new Error("secure store unavailable"));

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Clear unbound key" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear unbound key" }));

    expect(await screen.findByText("Could not clear unbound key.")).toBeOnTheScreen();
    expect(screen.getByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
  });

  it("copies the serialized public key and shows a toast", async () => {
    load.mockResolvedValue(fixedRecord);
    setStringAsync.mockResolvedValue(true);

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Copy public key" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Copy public key" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({
        type: "success",
        text1: "Public key copied",
        visibilityTime: 2000,
        position: "bottom",
      });
    });
    expect(setStringAsync).toHaveBeenCalledWith(serializeUserPublicKey(fixedPublicKey));
  });

  it("shows an error when create fails", async () => {
    load.mockResolvedValue(null);
    create.mockRejectedValue(new Error("secure store unavailable"));

    await render(<KeysPage />);

    expect(await screen.findByText("Create user private key")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Create user private key" }));

    expect(await screen.findByText("Could not create user private key.")).toBeOnTheScreen();
    expect(screen.getByText("Create user private key")).toBeOnTheScreen();
  });
});
