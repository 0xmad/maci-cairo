import { type JSX } from "react";
import { Route, Routes } from "react-router-dom";

import { Shell } from "./layouts";
import { DeployPage, MaciPage } from "./pages";
import { NetworkProvider } from "./providers/Network";

export const App = (): JSX.Element => (
  <NetworkProvider>
    <Routes>
      <Route element={<Shell />}>
        <Route element={<DeployPage />} path="/" />

        <Route element={<MaciPage />} path="/maci" />

        <Route element={<MaciPage />} path="/maci/:address" />
      </Route>
    </Routes>
  </NetworkProvider>
);
