import { render, screen } from "@testing-library/react-native";

import { SettingsMenuCard } from "..";

describe("SettingsMenuCard", () => {
  it("renders a keys link", async () => {
    await render(<SettingsMenuCard />);

    expect(screen.getByTestId("settings-keys-link")).toBeOnTheScreen();
    expect(screen.getByLabelText("Keys")).toBeOnTheScreen();
  });
});
