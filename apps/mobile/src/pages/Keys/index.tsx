import { type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";

import { formatUserPublicKeyPreview } from "../../keys/unboundUserKey";

import { showKeysDebugControls } from "./showKeysDebugControls";
import { useKeys } from "./useKeys";

const containerStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 24,
} as const;

const infoStyle = {
  textAlign: "center",
  fontSize: 16,
  lineHeight: 22,
} as const;

const publicKeyStyle = {
  textAlign: "center",
  fontSize: 28,
  lineHeight: 34,
  fontWeight: "600",
} as const;

const buttonStyle = {
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderWidth: 1,
  borderColor: "#111",
  borderRadius: 8,
} as const;

const debugButtonStyle = {
  ...buttonStyle,
  borderStyle: "dashed",
  opacity: 0.7,
} as const;

export const KeysPage = (): ReactElement => {
  const { ready, record, error, onCreate, onCopyPublicKey, onClearUnboundKey } = useKeys();

  if (!ready) {
    return (
      <View style={containerStyle}>
        <Text>Loading keys…</Text>
      </View>
    );
  }

  if (record === null) {
    return (
      <View style={containerStyle}>
        <Text style={infoStyle}>Create a user private key for voting. It is stored securely on this device.</Text>

        <Pressable
          accessibilityLabel="Create user private key"
          accessibilityRole="button"
          style={buttonStyle}
          onPress={onCreate}
        >
          <Text>Create user private key</Text>
        </Pressable>

        {error === null ? null : <Text>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={infoStyle}>
        Your public key is ready. It is not bound to a MACI yet - you will use it when you sign up.
      </Text>

      <Text style={publicKeyStyle}>{formatUserPublicKeyPreview(record.publicKey)}</Text>

      <Pressable
        accessibilityLabel="Copy public key"
        accessibilityRole="button"
        style={buttonStyle}
        onPress={onCopyPublicKey}
      >
        <Text>Copy public key</Text>
      </Pressable>

      {showKeysDebugControls() ? (
        <Pressable
          accessibilityLabel="Clear unbound key"
          accessibilityRole="button"
          style={debugButtonStyle}
          onPress={onClearUnboundKey}
        >
          <Text>Clear unbound key</Text>
        </Pressable>
      ) : null}

      {error === null ? null : <Text>{error}</Text>}
    </View>
  );
};
