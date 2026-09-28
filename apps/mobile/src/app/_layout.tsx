import { Stack } from "expo-router";
import { type ReactElement } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { AppHeader } from "../components/AppHeader";

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

export const RootLayout = (): ReactElement => (
  <View style={rootStyle}>
    <AppHeader />

    <View style={stackStyle}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>

    <View pointerEvents="box-none" style={toastHostStyle}>
      <Toast bottomOffset={40} position="bottom" />
    </View>
  </View>
);

export default RootLayout;
