import { type ReactElement, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { type LockView } from "./createLock";

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

const buttonStyle = {
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderWidth: 1,
  borderColor: "#111",
  borderRadius: 8,
} as const;

interface LockGateProps {
  view: LockView;
  onRetry: () => void;
  children: ReactNode;
}

export const LockGate = ({ view, onRetry, children }: LockGateProps): ReactElement => {
  if (view.status === "open") {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  if (view.reason === "prompting") {
    return <View style={containerStyle} />;
  }

  return (
    <View style={containerStyle}>
      {view.reason === "device-cannot-authenticate" ? (
        <Text style={infoStyle}>Set a device passcode or biometrics to use the voter client.</Text>
      ) : null}

      <Pressable accessibilityLabel="Unlock" accessibilityRole="button" style={buttonStyle} onPress={onRetry}>
        <Text>Unlock</Text>
      </Pressable>
    </View>
  );
};
