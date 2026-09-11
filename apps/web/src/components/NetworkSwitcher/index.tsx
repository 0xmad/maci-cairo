import { type JSX, type SyntheticEvent } from "react";

import { isAppNetwork, rpcUrlFor } from "../../config/network";
import { useNetwork } from "../../providers/Network";

import styles from "./index.module.css";

export const NetworkSwitcher = (): JSX.Element => {
  const { network, setNetwork } = useNetwork();

  const handleChange = async (event: SyntheticEvent<HTMLSelectElement>): Promise<void> => {
    const next = event.currentTarget.value;

    if (next !== "sepolia" && isAppNetwork(next)) {
      await setNetwork(next);
    }
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      Network
      <select
        className={`${styles.select} rounded border border-zinc-600 bg-zinc-950 py-1 pl-2 pr-7`}
        title={rpcUrlFor(network)}
        value={network}
        onChange={handleChange}
      >
        <option value="local">Local</option>

        <option disabled value="sepolia">
          Sepolia
        </option>
      </select>
    </label>
  );
};
