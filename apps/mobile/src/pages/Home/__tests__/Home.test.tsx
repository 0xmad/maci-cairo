import { render, screen } from "@testing-library/react-native";

import { HomePage } from "../..";

describe("Home page", () => {
  it("shows the voter client stub", async () => {
    await render(<HomePage />);

    expect(screen.getByText("Voter client")).toBeOnTheScreen();
    expect(screen.getByText("Stub. Register and Ballot are not in this slice.")).toBeOnTheScreen();
  });
});
