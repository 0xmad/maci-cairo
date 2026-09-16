import { type DeployMaciCheckpoint, type DeployMaciResult, type MaciNetwork } from "maci-deploy/maci";

import { type Page, type Pagination } from "../utils/pagination.js";

export interface MaciListItem {
  address: string;
  network: MaciNetwork;
  createdAtMs: number;
}

export interface MaciInstanceRecord extends DeployMaciResult {
  circuitProfile: string;
  policy: string;
  voteBalanceAssigner: string;
}

/** Checkpoints and recorded MACI instances from stand-up. */
export interface StandupStore {
  succeed: (jobId: string, completedAtMs: number, maci: MaciInstanceRecord) => Promise<void>;
  mergeCheckpoint: (patch: DeployMaciCheckpoint) => Promise<void>;
  readCheckpoint: () => Promise<DeployMaciCheckpoint | undefined>;
  clearCheckpoint: () => Promise<void>;
  listMacis: (pagination: Pagination) => Promise<Page<MaciListItem>>;
  readMaci: (address: string) => Promise<MaciInstanceRecord | undefined>;
}
