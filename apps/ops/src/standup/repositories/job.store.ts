import { type DeployMaciResult, type MaciNetwork } from "maci-deploy/maci";

import { type Page, type Pagination } from "../../utils/pagination.js";

export type JobStatus = "running" | "succeeded" | "failed";

export interface JobStep {
  seq: number;
  kind: string;
  name: string;
}

export interface MaciListItem {
  address: string;
  network: MaciNetwork;
}

export interface JobSnapshot {
  id: string;
  kind: "standup";
  status: JobStatus;
  error?: string;
  steps: JobStep[];
}

export interface NewJob {
  id: string;
  kind: "standup";
  createdAtMs: number;
}

/** Durable MACI stand-up job, step log, and recorded instances. */
export interface JobStore {
  tryBegin: (job: NewJob) => Promise<boolean>;
  appendStep: (jobId: string, step: JobStep) => Promise<void>;
  succeed: (jobId: string, completedAtMs: number, maci: DeployMaciResult) => Promise<void>;
  fail: (jobId: string, completedAtMs: number, error: string) => Promise<void>;
  latest: () => Promise<JobSnapshot | undefined>;
  listMacis: (pagination: Pagination) => Promise<Page<MaciListItem>>;
  readMaci: (address: string) => Promise<DeployMaciResult | undefined>;
}
