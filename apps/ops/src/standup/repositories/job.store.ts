import { type DeployMaciResult } from "maci-deploy/maci";

export type JobStatus = "running" | "succeeded" | "failed";

export interface JobStep {
  seq: number;
  kind: string;
  name: string;
}

export type CurrentMaci = DeployMaciResult;

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

/** Durable MACI stand-up job, step log, and current MACI. */
export interface JobStore {
  tryBegin: (job: NewJob) => Promise<boolean>;
  appendStep: (jobId: string, step: JobStep) => Promise<void>;
  succeed: (jobId: string, completedAtMs: number, maci: CurrentMaci) => Promise<void>;
  fail: (jobId: string, completedAtMs: number, error: string) => Promise<void>;
  latest: () => Promise<JobSnapshot | undefined>;
  currentMaci: () => Promise<CurrentMaci | undefined>;
}
