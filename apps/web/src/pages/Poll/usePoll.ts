import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { useNetwork } from "../../providers/Network";
import { type Poll } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { usePollStore } from "../../stores/poll";

export interface UsePollResult {
  maci?: string;
  pollAddress?: string;
  signedIn: boolean;
  poll?: Poll;
  ballotCount?: string;
  error?: string;
}

export function usePoll(): UsePollResult {
  const { address } = useParams();
  const { network } = useNetwork();
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const { poll, ballotCount, error, loadPollData, reset } = usePollStore();

  useEffect(() => {
    if (token === undefined || address === undefined || address.length === 0) {
      reset();

      return;
    }

    loadPollData(token, address, network).catch(() => undefined);
  }, [token, address, network, loadPollData, reset]);

  return {
    maci: poll?.maci,
    pollAddress: address,
    signedIn,
    poll,
    ballotCount,
    error,
  };
}
