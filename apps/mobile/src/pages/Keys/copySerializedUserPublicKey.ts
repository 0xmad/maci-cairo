import * as ExpoClipboard from "expo-clipboard";
import Toast from "react-native-toast-message";

import { serializeUserPublicKey, type UserPublicKey } from "../../keys/unboundUserKey";

export const copySerializedUserPublicKey = (publicKey: UserPublicKey): Promise<void> =>
  ExpoClipboard.setStringAsync(serializeUserPublicKey(publicKey))
    .then(() => {
      Toast.show({
        type: "success",
        text1: "Public key copied",
        visibilityTime: 2000,
        position: "bottom",
      });
    })
    .catch(() => {
      Toast.show({
        type: "error",
        text1: "Could not copy public key",
        visibilityTime: 2000,
        position: "bottom",
      });
    });
