import { type JobSnapshot } from "../job.store.js";

/** Latest job from `GET /job`. */
export class CurrentJobResponseDto {
  job!: JobSnapshot | null;

  incompleteStandUp!: boolean;

  currentMaci!: string | null;
}
