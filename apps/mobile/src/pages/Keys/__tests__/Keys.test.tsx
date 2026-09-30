import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ExpoClipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { KeysPage } from "..";
import { defaultMaciBinding } from "../../../keys/defaultMaciBinding";
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

jest.mock("../../../keys/defaultMaciBinding", () => ({
  defaultMaciBinding: {
    load: jest.fn(),
    hasStoredBinding: jest.fn(),
    bind: jest.fn(),
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
const loadBinding = jest.mocked(defaultMaciBinding.load);
const hasStoredBinding = jest.mocked(defaultMaciBinding.hasStoredBinding);
const bind = jest.mocked(defaultMaciBinding.bind);
const clearBinding = jest.mocked(defaultMaciBinding.clear);
const setStringAsync = jest.mocked(ExpoClipboard.setStringAsync);
const showToast = jest.mocked(Toast.show);
const showKeysDebugControlsMock = jest.mocked(showKeysDebugControls);
const useRouterMock = jest.mocked(useRouter);

const CONFIGURED_MACI = "0x0000000000000000000000000000000000000000000000001234567890abcdef";

describe("Keys page", () => {
  beforeEach(() => {
    load.mockReset();
    create.mockReset();
    clear.mockReset();
    loadBinding.mockReset();
    hasStoredBinding.mockReset();
    bind.mockReset();
    clearBinding.mockReset();
    loadBinding.mockResolvedValue(null);
    hasStoredBinding.mockResolvedValue(false);
    delete process.env.EXPO_PUBLIC_MACI_ADDRESS;
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
    expect(screen.getByRole("button", { name: "Clear key" })).toBeOnTheScreen();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("hides the clear control outside development", async () => {
    showKeysDebugControlsMock.mockReturnValue(false);
    load.mockResolvedValue(fixedRecord);

    await render(<KeysPage />);

    expect(await screen.findByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Clear key" })).toBeNull();
  });

  it("clears the unbound key from the debug control", async () => {
    load.mockResolvedValue(fixedRecord);
    clear.mockResolvedValue(undefined);

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Clear key" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear key" }));

    await waitFor(() => {
      expect(clear).toHaveBeenCalled();
    });
  });

  it("shows an error when clear fails", async () => {
    load.mockResolvedValue(fixedRecord);
    clear.mockRejectedValue(new Error("secure store unavailable"));

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Clear key" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear key" }));

    expect(await screen.findByText("Could not clear key.")).toBeOnTheScreen();
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

  it("shows an empty state when no MACI address is configured", async () => {
    load.mockResolvedValue(fixedRecord);

    await render(<KeysPage />);

    expect(await screen.findByText("No MACI is configured for this build.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Use this MACI" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("binds the unbound key when the voter confirms the configured MACI", async () => {
    load.mockResolvedValue(fixedRecord);
    process.env.EXPO_PUBLIC_MACI_ADDRESS = "0x1234567890abcdef";
    bind.mockResolvedValue({
      maciAddress: CONFIGURED_MACI,
      publicKey: fixedPublicKey,
    });

    await render(<KeysPage />);

    expect(await screen.findByText("0x0000…cdef")).toBeOnTheScreen();
    expect(screen.queryByRole("textbox")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Use this MACI" }));

    expect(await screen.findByText("This key is bound to this MACI.")).toBeOnTheScreen();
    expect(screen.getByText("0x0000…cdef")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Use this MACI" })).toBeNull();
    expect(screen.queryByText("Create user private key")).toBeNull();
    expect(bind).toHaveBeenCalled();
  });

  it("shows a key already bound to the configured MACI", async () => {
    load.mockResolvedValue(null);
    process.env.EXPO_PUBLIC_MACI_ADDRESS = "0x1234567890abcdef";
    loadBinding.mockResolvedValue({
      maciAddress: CONFIGURED_MACI,
      publicKey: fixedPublicKey,
    });

    await render(<KeysPage />);

    expect(await screen.findByText("This key is bound to this MACI.")).toBeOnTheScreen();
    expect(screen.getByText("0x0000…cdef")).toBeOnTheScreen();
    expect(screen.getByText(formatUserPublicKeyPreview(fixedPublicKey))).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Use this MACI" })).toBeNull();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("hides the clear control for a bound key outside development", async () => {
    showKeysDebugControlsMock.mockReturnValue(false);
    load.mockResolvedValue(null);
    loadBinding.mockResolvedValue({
      maciAddress: CONFIGURED_MACI,
      publicKey: fixedPublicKey,
    });

    await render(<KeysPage />);

    expect(await screen.findByText("This key is bound to this MACI.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Clear key" })).toBeNull();
  });

  it("clears a key bound to the configured MACI from the debug control", async () => {
    load.mockResolvedValue(null);
    loadBinding.mockResolvedValue({
      maciAddress: CONFIGURED_MACI,
      publicKey: fixedPublicKey,
    });
    clearBinding.mockResolvedValue(undefined);
    clear.mockResolvedValue(undefined);

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Clear key" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear key" }));

    await waitFor(() => {
      expect(clearBinding).toHaveBeenCalled();
    });
    expect(clear).toHaveBeenCalled();
  });

  it("hides the bound-key clear control outside development", async () => {
    showKeysDebugControlsMock.mockReturnValue(false);
    load.mockResolvedValue(null);
    hasStoredBinding.mockResolvedValue(true);

    await render(<KeysPage />);

    expect(await screen.findByText("A user private key is already bound to a MACI.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Clear key" })).toBeNull();
  });

  it("does not offer another unbound key when a binding is already stored", async () => {
    load.mockResolvedValue(null);
    hasStoredBinding.mockResolvedValue(true);

    await render(<KeysPage />);

    expect(await screen.findByText("A user private key is already bound to a MACI.")).toBeOnTheScreen();
    expect(screen.queryByText("Create user private key")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use this MACI" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("does not confirm a second key when an unbound key and a stored binding both exist", async () => {
    load.mockResolvedValue(fixedRecord);
    hasStoredBinding.mockResolvedValue(true);
    process.env.EXPO_PUBLIC_MACI_ADDRESS = "0x1234567890abcdef";

    await render(<KeysPage />);

    expect(await screen.findByText("A user private key is already bound to a MACI.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Use this MACI" })).toBeNull();
    expect(screen.queryByText("Create user private key")).toBeNull();
  });

  it("shows an error when bind fails", async () => {
    load.mockResolvedValue(fixedRecord);
    process.env.EXPO_PUBLIC_MACI_ADDRESS = "0x1234567890abcdef";
    bind.mockRejectedValue(new Error("secure store unavailable"));

    await render(<KeysPage />);

    expect(await screen.findByRole("button", { name: "Use this MACI" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Use this MACI" }));

    expect(await screen.findByText("Could not bind this key to the MACI.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Use this MACI" })).toBeOnTheScreen();
  });

  it("shows an error when clearing a key bound to this MACI fails", async () => {
    load.mockResolvedValue(null);
    loadBinding.mockResolvedValue({
      maciAddress: CONFIGURED_MACI,
      publicKey: fixedPublicKey,
    });
    clearBinding.mockRejectedValue(new Error("secure store unavailable"));

    await render(<KeysPage />);

    expect(await screen.findByText("This key is bound to this MACI.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear key" }));

    expect(await screen.findByText("Could not clear key.")).toBeOnTheScreen();
    expect(screen.getByText("This key is bound to this MACI.")).toBeOnTheScreen();
    expect(clear).not.toHaveBeenCalled();
  });

  it("shows an error when clearing a key bound to another MACI fails", async () => {
    load.mockResolvedValue(null);
    hasStoredBinding.mockResolvedValue(true);
    clearBinding.mockRejectedValue(new Error("secure store unavailable"));

    await render(<KeysPage />);

    expect(await screen.findByText("A user private key is already bound to a MACI.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Clear key" }));

    expect(await screen.findByText("Could not clear key.")).toBeOnTheScreen();
    expect(screen.getByText("A user private key is already bound to a MACI.")).toBeOnTheScreen();
    expect(clear).not.toHaveBeenCalled();
  });
});
