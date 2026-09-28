import { Link, usePathname } from "expo-router";
import { type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";

import { useHasUnboundKey } from "../../keys";

const containerStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: 24,
} as const;

const buttonStyle = {
  marginTop: 8,
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderWidth: 1,
  borderColor: "#111",
  borderRadius: 8,
} as const;

export const HomePage = (): ReactElement => {
  const pathname = usePathname();
  const { ready, hasKey } = useHasUnboundKey(pathname);

  return (
    <View style={containerStyle}>
      <Text>Stub. Signup and Ballot are not in this slice.</Text>

      {!ready || hasKey ? null : (
        <Link asChild accessibilityRole="link" href="/keys">
          <Pressable accessibilityLabel="Set up keys" style={buttonStyle}>
            <Text>Set up keys</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
};
