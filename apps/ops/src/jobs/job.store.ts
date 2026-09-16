export type JobStatus = "running" | "succeeded" | "failed" | "interrupted";

export type JobKind = "standup" | "create_poll";

export interface JobStep {
  seq: number;
  kind: string;
  name: string;
}

export interface JobSnapshot {
  id: string;
  kind: JobKind;
  status: JobStatus;
  error?: string;
  steps: JobStep[];
}

export interface NewJob {
  id: string;
  kind: JobKind;
  createdAtMs: number;
}

/** Durable job row, step log, and at-most-one running job. */
export interface JobStore {
  tryBegin: (job: NewJob) => Promise<boolean>;
  appendStep: (jobId: string, step: JobStep) => Promise<void>;
  markSucceeded: (jobId: string, completedAtMs: number) => Promise<void>;
  fail: (jobId: string, completedAtMs: number, error: string) => Promise<void>;
  interruptRunning: (completedAtMs: number, error: string) => Promise<void>;
  tryResume: (jobId: string) => Promise<boolean>;
  latest: () => Promise<JobSnapshot | undefined>;
}
