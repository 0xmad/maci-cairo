import { renderRouter, screen } from "expo-router/testing-library";

import HomeRoute from "..";
import Layout from "../_layout";

describe("app routes", () => {
  it("shows the voter client stub at home", async () => {
    await renderRouter({
      _layout: Layout,
      index: HomeRoute,
    });

    expect(await screen.findByText("Voter client")).toBeOnTheScreen();
  });
});
