import { deployMaci, type DeployMaciResult, type DeployMaciStep, type SncastOps } from "maci-deploy/maci";

import { type Page, type Pagination } from "../utils/pagination.js";

import { type JobSnapshot, type JobStep, type JobStore, type MaciListItem } from "./repositories/job.store.js";

export interface StandupServiceDeps {
  store: JobStore;
  sncast: SncastOps;
  nowMs: () => number;
  randomId: () => string;
  /** Defaults to `setImmediate` so HTTP start is not blocked on the graph. */
  scheduleWork?: (work: () => void) => void;
}

export type JobEvent =
  { type: "step"; step: JobStep } | { type: "completed"; status: "succeeded" | "failed"; error?: string };

/**
 * MACI stand-up jobs: at most one running, instances recorded only after a full success.
 */
export class StandupService {
  readonly #deps: StandupServiceDeps;

  readonly #listeners = new Set<(event: JobEvent) => void>();

  constructor(deps: StandupServiceDeps) {
    this.#deps = deps;
  }

  async startStandUp(): Promise<{ jobId: string }> {
    const jobId = this.#deps.randomId();
    const began = await this.#deps.store.tryBegin({ id: jobId, kind: "standup", createdAtMs: this.#deps.nowMs() });

    if (!began) {
      throw new Error("busy");
    }

    const schedule = this.#deps.scheduleWork ?? setImmediate;
    schedule(() => {
      this.run(jobId).then(
        () => undefined,
        () => undefined,
      );
    });

    return { jobId };
  }

  currentJob(): Promise<JobSnapshot | undefined> {
    return this.#deps.store.latest();
  }

  listMacis(pagination: Pagination): Promise<Page<MaciListItem>> {
    return this.#deps.store.listMacis(pagination);
  }

  readMaci(address: string): Promise<DeployMaciResult | undefined> {
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
            : { type: "completed", status: "failed", error: job.error };

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

  private async run(jobId: string): Promise<void> {
    let seq = 0;

    try {
      const result = await deployMaci(this.#deps.sncast, {
        onStep: async (step: DeployMaciStep): Promise<void> => {
          if (step.kind === "declare") {
            return;
          }

          seq += 1;
          const recorded: JobStep = { seq, kind: step.kind, name: step.name };
          await this.#deps.store.appendStep(jobId, recorded);
          this.emit({ type: "step", step: recorded });
        },
      });
      await this.#deps.store.succeed(jobId, this.#deps.nowMs(), result);
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
