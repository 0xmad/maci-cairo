import { type JobSnapshot } from "../repositories/job.store.js";

/** Latest stand-up job from `GET /job`. */
export class CurrentJobResponseDto {
  job!: JobSnapshot | null;

  incompleteStandUp!: boolean;
}
