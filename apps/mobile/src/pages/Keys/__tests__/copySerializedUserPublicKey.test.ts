import * as ExpoClipboard from "expo-clipboard";
import Toast from "react-native-toast-message";

import { fixedPublicKey } from "../../../keys/testFixtures";
import { serializeUserPublicKey } from "../../../keys/unboundUserKey";
import { copySerializedUserPublicKey } from "../copySerializedUserPublicKey";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

jest.mock("react-native-toast-message", () => {
  const show = jest.fn();

  return {
    __esModule: true,
    default: Object.assign(() => null, { show, hide: jest.fn() }),
  };
});

const setStringAsync = jest.mocked(ExpoClipboard.setStringAsync);
const showToast = jest.mocked(Toast.show);

describe("copySerializedUserPublicKey", () => {
  beforeEach(() => {
    setStringAsync.mockReset();
    showToast.mockReset();
  });

  it("copies the serialized public key and shows a success toast", async () => {
    setStringAsync.mockResolvedValue(true);

    await copySerializedUserPublicKey(fixedPublicKey);

    expect(setStringAsync).toHaveBeenCalledWith(serializeUserPublicKey(fixedPublicKey));
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      text1: "Public key copied",
      visibilityTime: 2000,
      position: "bottom",
    });
  });

  it("shows an error toast when clipboard copy fails", async () => {
    setStringAsync.mockRejectedValue(new Error("clipboard unavailable"));

    await copySerializedUserPublicKey(fixedPublicKey);

    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      text1: "Could not copy public key",
      visibilityTime: 2000,
      position: "bottom",
    });
  });
});
