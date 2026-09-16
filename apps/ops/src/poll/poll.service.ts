import { createPoll, integerFromFelt, type CreatePollStep } from "maci-deploy/createPoll";
import { type SncastOps } from "maci-deploy/maci";

import { type JobEvents } from "../jobs/job.events.js";
import { type JobStore, type JobStep } from "../jobs/job.store.js";
import { type StandupStore } from "../standup/standup.store.js";
import { type Page, type Pagination } from "../utils/pagination.js";

import { type CreatePollIntent, type PollListItem, type PollStore } from "./poll.store.js";

export interface PollServiceDeps {
  jobs: JobStore;
  polls: PollStore;
  standup: StandupStore;
  events: JobEvents;
  sncast: SncastOps;
  nowMs: () => number;
  randomId: () => string;
  scheduleWork?: (work: () => void) => void;
}

function createPollRecord(maci: string, intent: CreatePollIntent) {
  return {
    maci,
    startDate: intent.startDate.toString(),
    endDate: intent.endDate.toString(),
    pollPublicKeyX: intent.pollPublicKey[0].toString(),
    pollPublicKeyY: intent.pollPublicKey[1].toString(),
  };
}

/**
 * Create Poll jobs against the MACI in the request path. Shares the single running job with stand-up.
 */
export class PollService {
  readonly #deps: PollServiceDeps;

  constructor(deps: PollServiceDeps) {
    this.#deps = deps;
  }

  async listPolls(maciAddress: string, pagination: Pagination): Promise<Page<PollListItem>> {
    const maci = await this.#deps.standup.readMaci(maciAddress);

    if (maci === undefined) {
      throw new Error("maci not found");
    }

    return this.#deps.polls.listPolls(maciAddress, pagination);
  }

  async startCreatePoll(maciAddress: string, intent: CreatePollIntent): Promise<{ jobId: string }> {
    const latest = await this.#deps.jobs.latest();

    if (latest?.status === "running") {
      throw new Error("busy");
    }

    if ((await this.#deps.standup.readCheckpoint()) !== undefined) {
      throw new Error("incomplete stand-up");
    }

    const maci = await this.#deps.standup.readMaci(maciAddress);

    if (maci === undefined) {
      throw new Error("maci not found");
    }

    let jobId: string;

    if (latest?.kind === "create_poll" && (latest.status === "failed" || latest.status === "interrupted")) {
      const stored = await this.#deps.polls.readCreatePoll(latest.id);

      if (stored === undefined || stored.maci === maci.maci) {
        const resumed = await this.#deps.jobs.tryResume(latest.id);

        if (!resumed) {
          throw new Error("busy");
        }

        jobId = latest.id;

        if (stored?.pollId === undefined) {
          await this.#deps.polls.writeCreatePoll(jobId, createPollRecord(maci.maci, intent));
        }
      } else {
        jobId = await this.beginCreatePoll(maci.maci, intent);
      }
    } else {
      jobId = await this.beginCreatePoll(maci.maci, intent);
    }

    const schedule = this.#deps.scheduleWork ?? setImmediate;
    schedule(() => {
      this.runCreatePoll(jobId).then(
        () => undefined,
        () => undefined,
      );
    });

    return { jobId };
  }

  private async beginCreatePoll(maci: string, intent: CreatePollIntent): Promise<string> {
    const jobId = this.#deps.randomId();
    const began = await this.#deps.jobs.tryBegin({
      id: jobId,
      kind: "create_poll",
      createdAtMs: this.#deps.nowMs(),
    });

    if (!began) {
      throw new Error("busy");
    }

    await this.#deps.polls.writeCreatePoll(jobId, createPollRecord(maci, intent));

    return jobId;
  }

  private async runCreatePoll(jobId: string): Promise<void> {
    try {
      const existing = await this.#deps.jobs.latest();
      let seq = existing?.id === jobId ? existing.steps.reduce((max, step) => Math.max(max, step.seq), 0) : 0;
      const record = await this.#deps.polls.readCreatePoll(jobId);

      if (record === undefined) {
        throw new Error("failed");
      }
      let { pollId } = record;

      if (pollId === undefined) {
        pollId = integerFromFelt(
          this.#deps.sncast.field("response", [
            "call",
            "--contract-address",
            record.maci,
            "--function",
            "next_poll_id",
          ]),
        ).toString();
        await this.#deps.polls.writeCreatePoll(jobId, { ...record, pollId });
        seq += 1;
        const frozen: JobStep = { seq, kind: "call", name: "next_poll_id" };
        await this.#deps.jobs.appendStep(jobId, frozen);
        this.#deps.events.emit({ type: "step", step: frozen });
      }

      const instance = await this.#deps.standup.readMaci(record.maci);

      if (instance === undefined) {
        throw new Error("MACI instance not found");
      }

      const created = await createPoll(
        { field: (key: string, args: string[]): string => this.#deps.sncast.field(key, args) },
        {
          maci: record.maci,
          startDate: BigInt(record.startDate),
          endDate: BigInt(record.endDate),
          pollPublicKey: [BigInt(record.pollPublicKeyX), BigInt(record.pollPublicKeyY)],
        },
        {
          frozenPollId: BigInt(pollId),
          intendedCoordinator: instance.coordinator,
          onStep: async (step: CreatePollStep): Promise<void> => {
            seq += 1;
            const recorded: JobStep = { seq, kind: step.kind, name: step.name };
            await this.#deps.jobs.appendStep(jobId, recorded);
            this.#deps.events.emit({ type: "step", step: recorded });
          },
        },
      );
      await this.#deps.polls.recordPoll({
        maci: created.maci,
        address: created.poll,
        pollId: created.pollId,
        startDate: record.startDate,
        endDate: record.endDate,
        pollPublicKey: [record.pollPublicKeyX, record.pollPublicKeyY],
        createdAtMs: this.#deps.nowMs(),
      });
      await this.#deps.jobs.markSucceeded(jobId, this.#deps.nowMs());
      this.#deps.events.emit({ type: "completed", status: "succeeded" });
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "failed";
      await this.#deps.jobs.fail(jobId, this.#deps.nowMs(), error);
      this.#deps.events.emit({ type: "completed", status: "failed", error });
    }
  }
}
