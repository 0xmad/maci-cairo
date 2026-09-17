import { Stack } from "expo-router";
import { type ReactElement } from "react";

export const RootLayout = (): ReactElement => <Stack screenOptions={{ headerShown: false }} />;

export default RootLayout;
