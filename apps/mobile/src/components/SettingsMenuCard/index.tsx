import { Link } from "expo-router";
import { type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";

const KEYS_HREF = "/keys" as const;

const menuPopupStyle = {
  position: "absolute",
  top: "100%",
  right: 12,
  marginTop: 4,
  minWidth: 160,
  borderWidth: 1,
  borderColor: "#111",
  borderRadius: 8,
  backgroundColor: "#fff",
  zIndex: 21,
} as const;

const menuItemStyle = {
  paddingVertical: 12,
  paddingHorizontal: 16,
} as const;

const menuItemTextStyle = {
  fontSize: 16,
} as const;

export const SettingsMenuCard = (): ReactElement => (
  <View accessibilityRole="menu" style={menuPopupStyle}>
    <Link asChild href={KEYS_HREF} testID="settings-keys-link">
      <Pressable accessibilityLabel="Keys" accessibilityRole="menuitem" style={menuItemStyle}>
        <Text style={menuItemTextStyle}>Keys</Text>
      </Pressable>
    </Link>
  </View>
);
