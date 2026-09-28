import { usePathname, useRouter } from "expo-router";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ROUTES, normalizePathname } from "../../navigation/normalizePathname";
import { SettingsMenuCard } from "../SettingsMenuCard";

const TITLES: Record<(typeof ROUTES)[number], string> = {
  "/": "Voter client",
  "/keys": "Keys",
};

const headerShellStyle = {
  position: "relative",
  zIndex: 20,
  backgroundColor: "#fff",
} as const;

const headerStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: "#111",
  backgroundColor: "#fff",
} as const;

const leftSlotStyle = {
  minWidth: 64,
  alignItems: "flex-start",
} as const;

const rightSlotStyle = {
  minWidth: 64,
  alignItems: "flex-end",
} as const;

const buttonStyle = {
  paddingVertical: 4,
  paddingHorizontal: 8,
} as const;

const buttonTextStyle = {
  fontSize: 18,
} as const;

const titleStyle = {
  fontSize: 18,
  fontWeight: "600",
} as const;

const settingsLabelStyle = {
  fontSize: 18,
} as const;

const menuBackdropStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 10,
} as const;

export const AppHeader = (): ReactElement => {
  const pathname = usePathname();
  const normalizedPath = normalizePathname(pathname);
  const router = useRouter();
  const routeIndex = ROUTES.indexOf(normalizedPath);
  const canGoBack = routeIndex > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathnameRef.current === pathname) {
      return;
    }

    pathnameRef.current = pathname;
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <View style={headerShellStyle}>
        <SafeAreaView edges={["top"]} style={headerStyle}>
          {canGoBack ? (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              style={[buttonStyle, leftSlotStyle]}
              onPress={() => {
                router.push(ROUTES[routeIndex - 1]);
              }}
            >
              <Text style={buttonTextStyle}>Back</Text>
            </Pressable>
          ) : (
            <View style={leftSlotStyle} />
          )}

          <Text style={titleStyle}>{TITLES[normalizedPath]}</Text>

          <View style={rightSlotStyle}>
            <Pressable
              accessibilityLabel="Settings"
              accessibilityRole="button"
              style={buttonStyle}
              onPress={() => {
                setMenuOpen((open) => !open);
              }}
            >
              <Text style={settingsLabelStyle}>Settings</Text>
            </Pressable>
          </View>
        </SafeAreaView>

        {menuOpen ? <SettingsMenuCard /> : null}
      </View>

      {menuOpen ? (
        <Pressable
          accessibilityLabel="Dismiss settings menu"
          accessibilityRole="button"
          style={menuBackdropStyle}
          testID="settings-menu-backdrop"
          onPress={() => {
            setMenuOpen(false);
          }}
        />
      ) : null}
    </>
  );
};
