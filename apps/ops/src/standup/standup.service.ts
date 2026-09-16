import {
  ASSIGNER_CONSTANT_VOTE_BALANCE,
  CIRCUIT_PROFILE_SMALL,
  POLICY_FREE_FOR_ALL,
  STATE_TREE_DEPTH,
  VOTE_OPTIONS,
} from "maci-deploy/config";
import { resolveStandupIntent, type DeployMaciIntent } from "maci-deploy/intent";
import { deployMaci, type DeployMaciStep, type SncastOps } from "maci-deploy/maci";

import { type JobEvents, type JobEvent } from "../jobs/job.events.js";
import { type JobSnapshot, type JobStore, type JobStep } from "../jobs/job.store.js";
import { type Page, type Pagination } from "../utils/pagination.js";

import { type MaciInstanceRecord, type MaciListItem, type StandupStore } from "./standup.store.js";

export interface StandupServiceDeps {
  jobs: JobStore;
  standup: StandupStore;
  events: JobEvents;
  sncast: SncastOps;
  nowMs: () => number;
  randomId: () => string;
  /** Defaults to `setImmediate` so HTTP start is not blocked on the graph. */
  scheduleWork?: (work: () => void) => void;
}

export interface StandUpCatalog {
  circuitProfiles: { id: string; maxSignups: number; maxVoteOptions: number }[];
  policies: { id: string }[];
  assigners: { id: string }[];
}

export type { JobEvent } from "../jobs/job.events.js";

export const STANDUP_SERVICE = "STANDUP_SERVICE";

/**
 * MACI stand-up jobs: instances recorded only after a full success.
 */
export class StandupService {
  readonly #deps: StandupServiceDeps;

  constructor(deps: StandupServiceDeps) {
    this.#deps = deps;
  }

  readStandUpCatalog(): StandUpCatalog {
    return {
      circuitProfiles: [
        {
          id: CIRCUIT_PROFILE_SMALL,
          maxSignups: 2 ** STATE_TREE_DEPTH,
          maxVoteOptions: VOTE_OPTIONS,
        },
      ],
      policies: [{ id: POLICY_FREE_FOR_ALL }],
      assigners: [{ id: ASSIGNER_CONSTANT_VOTE_BALANCE }],
    };
  }

  async startStandUp(intent: DeployMaciIntent): Promise<{ jobId: string }> {
    resolveStandupIntent(intent);

    const latest = await this.#deps.jobs.latest();
    const checkpoint = await this.#deps.standup.readCheckpoint();
    let jobId: string;

    if (
      checkpoint !== undefined &&
      latest !== undefined &&
      (latest.status === "failed" || latest.status === "interrupted")
    ) {
      const resumed = await this.#deps.jobs.tryResume(latest.id);

      if (!resumed) {
        throw new Error("busy");
      }

      jobId = latest.id;
    } else {
      jobId = this.#deps.randomId();
      const began = await this.#deps.jobs.tryBegin({ id: jobId, kind: "standup", createdAtMs: this.#deps.nowMs() });

      if (!began) {
        throw new Error("busy");
      }
    }

    const schedule = this.#deps.scheduleWork ?? setImmediate;
    schedule(() => {
      this.run(jobId, intent).then(
        () => undefined,
        () => undefined,
      );
    });

    return { jobId };
  }

  async recoverInterrupted(): Promise<void> {
    await this.#deps.jobs.interruptRunning(this.#deps.nowMs(), "interrupted");
  }

  async hasIncompleteStandUp(): Promise<boolean> {
    return (await this.#deps.standup.readCheckpoint()) !== undefined;
  }

  async discardStandUp(): Promise<void> {
    const job = await this.#deps.jobs.latest();

    if (job?.status === "running") {
      throw new Error("busy");
    }

    await this.#deps.standup.clearCheckpoint();
  }

  currentJob(): Promise<JobSnapshot | undefined> {
    return this.#deps.jobs.latest();
  }

  async currentMaciInstance(): Promise<MaciInstanceRecord | undefined> {
    const listed = await this.#deps.standup.listMacis({ page: 1, pageSize: 1 });

    if (listed.items.length === 0) {
      return undefined;
    }

    return this.#deps.standup.readMaci(listed.items[0].address);
  }

  listMacis(pagination: Pagination): Promise<Page<MaciListItem>> {
    return this.#deps.standup.listMacis(pagination);
  }

  readMaci(address: string): Promise<MaciInstanceRecord | undefined> {
    return this.#deps.standup.readMaci(address);
  }

  async subscribe(listener: (event: JobEvent) => void): Promise<() => void> {
    return this.#deps.events.subscribe(await this.#deps.jobs.latest(), listener);
  }

  private async run(jobId: string, intent: DeployMaciIntent): Promise<void> {
    const existing = await this.#deps.jobs.latest();
    let seq = existing?.id === jobId ? existing.steps.reduce((max, step) => Math.max(max, step.seq), 0) : 0;
    let lastDeploy: string | undefined;
    const sncast: SncastOps = {
      declareClass: (contractName: string): string => this.#deps.sncast.declareClass(contractName),
      field: (key: string, args: string[]): string => this.#deps.sncast.field(key, args),
      deployUnique: (classHash: string, argumentsExpr?: string): string => {
        lastDeploy = this.#deps.sncast.deployUnique(classHash, argumentsExpr);

        return lastDeploy;
      },
    };

    try {
      const checkpoint = await this.#deps.standup.readCheckpoint();
      const result = await deployMaci(sncast, intent, {
        checkpoint,
        onStep: async (step: DeployMaciStep): Promise<void> => {
          if (step.kind === "deploy" && lastDeploy !== undefined) {
            await this.#deps.standup.mergeCheckpoint({ [step.name]: lastDeploy });
          }

          if (step.kind === "declare") {
            return;
          }

          seq += 1;
          const recorded: JobStep = { seq, kind: step.kind, name: step.name };
          await this.#deps.jobs.appendStep(jobId, recorded);
          this.#deps.events.emit({ type: "step", step: recorded });
        },
      });
      await this.#deps.standup.succeed(jobId, this.#deps.nowMs(), {
        ...result,
        circuitProfile: intent.circuitProfile,
        policy: intent.policy,
        voteBalanceAssigner: intent.assigner,
      });
      this.#deps.events.emit({ type: "completed", status: "succeeded" });
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "failed";
      await this.#deps.jobs.fail(jobId, this.#deps.nowMs(), error);
      this.#deps.events.emit({ type: "completed", status: "failed", error });
    }
  }
}
