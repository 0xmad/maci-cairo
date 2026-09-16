import { type Page, type Pagination } from "../utils/pagination.js";

/** Frozen Create Poll attempt: MACI, form fields, and poll id. */
export interface CreatePollJob {
  maci: string;
  startDate: string;
  endDate: string;
  pollPublicKeyX: string;
  pollPublicKeyY: string;
  pollId?: string;
}

export interface CreatePollIntent {
  startDate: bigint;
  endDate: bigint;
  pollPublicKey: readonly [bigint, bigint];
}

/** Recorded Poll on a MACI instance. */
export interface PollListItem {
  address: string;
  pollId: string;
  startDate: string;
  endDate: string;
  pollPublicKey: readonly [string, string];
  createdAtMs: number;
}

/** Recorded Poll including its MACI. Address is unique across Polls. */
export interface Poll extends PollListItem {
  maci: string;
}

export interface PollStore {
  writeCreatePoll: (jobId: string, record: CreatePollJob) => Promise<void>;
  readCreatePoll: (jobId: string) => Promise<CreatePollJob | undefined>;
  recordPoll: (record: Poll) => Promise<void>;
  listPolls: (maci: string, pagination: Pagination) => Promise<Page<PollListItem>>;
  readPoll: (address: string) => Promise<Poll | undefined>;
}
