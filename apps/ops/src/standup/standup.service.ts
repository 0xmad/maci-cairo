import {
  ASSIGNER_CONSTANT_VOTE_BALANCE,
  CIRCUIT_PROFILE_SMALL,
  POLICY_FREE_FOR_ALL,
  STATE_TREE_DEPTH,
  VOTE_OPTIONS,
} from "maci-deploy/config";
import { resolveStandupIntent, type DeployMaciIntent } from "maci-deploy/intent";
import { deployMaci, type DeployMaciStep, type SncastOps } from "maci-deploy/maci";

import { type Page, type Pagination } from "../utils/pagination.js";

import {
  type JobSnapshot,
  type JobStep,
  type JobStore,
  type MaciInstanceRecord,
  type MaciListItem,
} from "./repositories/job.store.js";

export interface StandupServiceDeps {
  store: JobStore;
  sncast: SncastOps;
  nowMs: () => number;
  randomId: () => string;
  /** Defaults to `setImmediate` so HTTP start is not blocked on the graph. */
  scheduleWork?: (work: () => void) => void;
}

export type JobEvent =
  | { type: "step"; step: JobStep }
  | { type: "completed"; status: "succeeded" | "failed" | "interrupted"; error?: string };

export interface StandUpCatalog {
  circuitProfiles: { id: string; maxSignups: number; maxVoteOptions: number }[];
  policies: { id: string }[];
  assigners: { id: string }[];
}

/**
 * MACI stand-up jobs: at most one running, instances recorded only after a full success.
 */
export class StandupService {
  readonly #deps: StandupServiceDeps;

  readonly #listeners = new Set<(event: JobEvent) => void>();

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

    const latest = await this.#deps.store.latest();
    const checkpoint = await this.#deps.store.readCheckpoint();
    let jobId: string;

    if (
      checkpoint !== undefined &&
      latest !== undefined &&
      (latest.status === "failed" || latest.status === "interrupted")
    ) {
      const resumed = await this.#deps.store.tryResume(latest.id);

      if (!resumed) {
        throw new Error("busy");
      }

      jobId = latest.id;
    } else {
      jobId = this.#deps.randomId();
      const began = await this.#deps.store.tryBegin({ id: jobId, kind: "standup", createdAtMs: this.#deps.nowMs() });

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
    await this.#deps.store.interruptRunning(this.#deps.nowMs(), "interrupted");
  }

  async hasIncompleteStandUp(): Promise<boolean> {
    return (await this.#deps.store.readCheckpoint()) !== undefined;
  }

  async discardStandUp(): Promise<void> {
    const job = await this.#deps.store.latest();

    if (job?.status === "running") {
      throw new Error("busy");
    }

    await this.#deps.store.clearCheckpoint();
  }

  currentJob(): Promise<JobSnapshot | undefined> {
    return this.#deps.store.latest();
  }

  listMacis(pagination: Pagination): Promise<Page<MaciListItem>> {
    return this.#deps.store.listMacis(pagination);
  }

  readMaci(address: string): Promise<MaciInstanceRecord | undefined> {
    return this.#deps.store.readMaci(address);
  }

  async subscribe(listener: (event: JobEvent) => void): Promise<() => void> {
    const job = await this.#deps.store.latest();
    let lastSeq = 0;

    if (job !== undefined) {
      if (job.status !== "running") {
        const completed: JobEvent =
          job.status === "succeeded"
            ? { type: "completed", status: "succeeded" }
            : { type: "completed", status: job.status, error: job.error };

        listener(completed);

        return (): void => undefined;
      }

      job.steps.forEach((step) => {
        if (step.kind === "declare") {
          return;
        }

        listener({ type: "step", step });
        lastSeq = step.seq;
      });
    }

    const live = (event: JobEvent): void => {
      if (event.type === "step" && event.step.seq <= lastSeq) {
        return;
      }

      listener(event);
    };

    this.#listeners.add(live);

    return (): void => {
      this.#listeners.delete(live);
    };
  }

  private async run(jobId: string, intent: DeployMaciIntent): Promise<void> {
    const existing = await this.#deps.store.latest();
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
      const checkpoint = await this.#deps.store.readCheckpoint();
      const result = await deployMaci(sncast, intent, {
        checkpoint,
        onStep: async (step: DeployMaciStep): Promise<void> => {
          if (step.kind === "deploy" && lastDeploy !== undefined) {
            await this.#deps.store.mergeCheckpoint({ [step.name]: lastDeploy });
          }

          if (step.kind === "declare") {
            return;
          }

          seq += 1;
          const recorded: JobStep = { seq, kind: step.kind, name: step.name };
          await this.#deps.store.appendStep(jobId, recorded);
          this.emit({ type: "step", step: recorded });
        },
      });
      await this.#deps.store.succeed(jobId, this.#deps.nowMs(), {
        ...result,
        circuitProfile: intent.circuitProfile,
        policy: intent.policy,
        voteBalanceAssigner: intent.assigner,
      });
      this.emit({ type: "completed", status: "succeeded" });
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "failed";
      await this.#deps.store.fail(jobId, this.#deps.nowMs(), error);
      this.emit({ type: "completed", status: "failed", error });
    }
  }

  private emit(event: JobEvent): void {
    this.#listeners.forEach((listener) => {
      listener(event);
    });
  }
}
