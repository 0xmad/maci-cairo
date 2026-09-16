import { type JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { Shell } from "./layouts";
import { DeployPage, HomePage, MaciPage, PollPage } from "./pages";
import { NetworkProvider } from "./providers/Network";

export const App = (): JSX.Element => (
  <NetworkProvider>
    <Toaster closeButton richColors position="bottom-right" theme="dark" visibleToasts={10} />

    <Routes>
      <Route element={<Shell />}>
        <Route element={<HomePage />} path="/" />

        <Route element={<DeployPage />} path="/deploy" />

        <Route element={<Navigate replace to="/" />} path="/maci" />

        <Route element={<MaciPage />} path="/maci/:address" />

        <Route element={<PollPage />} path="/maci/:address/poll" />
      </Route>
    </Routes>
  </NetworkProvider>
);
