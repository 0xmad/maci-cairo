import { type JSX, type SyntheticEvent } from "react";

import { isAppNetwork, rpcUrlFor } from "../../config/network";
import { useNetwork } from "../../providers/Network";
import { Label, Select } from "../ui";

export const NetworkSwitcher = (): JSX.Element => {
  const { network, setNetwork } = useNetwork();

  const handleChange = async (event: SyntheticEvent<HTMLSelectElement>): Promise<void> => {
    const next = event.currentTarget.value;

    if (next !== "sepolia" && isAppNetwork(next)) {
      await setNetwork(next);
    }
  };

  return (
    <Label className="flex items-center gap-2 text-sm">
      Network
      <Select size="compact" title={rpcUrlFor(network)} value={network} onChange={handleChange}>
        <option value="local">Starknet Local</option>

        <option disabled value="sepolia">
          Sepolia
        </option>
      </Select>
    </Label>
  );
};
