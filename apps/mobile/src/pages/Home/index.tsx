import { type ReactElement } from "react";
import { Text, View } from "react-native";

const containerStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: 24,
} as const;

export const HomePage = (): ReactElement => (
  <View style={containerStyle}>
    <Text>Voter client</Text>

    <Text>Stub. Register and Ballot are not in this slice.</Text>
  </View>
);
