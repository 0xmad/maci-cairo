import { type JobSnapshot, type JobStep } from "./job.store.js";

export type JobEvent =
  | { type: "step"; step: JobStep }
  | { type: "completed"; status: "succeeded" | "failed" | "interrupted"; error?: string };

/** In-process live tail for the current job. Replay uses the stored snapshot. */
export class JobEvents {
  readonly #listeners = new Set<(event: JobEvent) => void>();

  emit(event: JobEvent): void {
    this.#listeners.forEach((listener) => {
      listener(event);
    });
  }

  subscribe(job: JobSnapshot | undefined, listener: (event: JobEvent) => void): () => void {
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
        if (job.kind === "standup" && step.kind === "declare") {
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
}
