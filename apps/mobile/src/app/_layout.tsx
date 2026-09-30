import { Stack } from "expo-router";
import { type ReactElement } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { AppHeader } from "../components/AppHeader";
import { LockGate } from "../lock/LockGate";
import { useLock } from "../lock/useLock";

const rootStyle = {
  flex: 1,
} as const;

const stackStyle = {
  flex: 1,
} as const;

const toastHostStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 100,
  elevation: 100,
} as const;

export const RootLayout = (): ReactElement => {
  const { view, retry } = useLock();

  return (
    <LockGate view={view} onRetry={retry}>
      <View style={rootStyle}>
        <AppHeader />

        <View style={stackStyle}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>

        <View pointerEvents="box-none" style={toastHostStyle}>
          <Toast bottomOffset={40} position="bottom" />
        </View>
      </View>
    </LockGate>
  );
};

export default RootLayout;
