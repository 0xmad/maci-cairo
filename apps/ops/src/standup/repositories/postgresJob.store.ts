import { count, desc, eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { type DeployMaciResult, type MaciNetwork } from "maci-deploy/maci";

import { type Page, type Pagination } from "../../utils/pagination.js";

import { jobs, jobSteps, maciInstances } from "./job.schema.js";
import {
  type JobSnapshot,
  type JobStatus,
  type JobStep,
  type JobStore,
  type MaciListItem,
  type NewJob,
} from "./job.store.js";

type JobDatabase = NodePgDatabase<{
  jobs: typeof jobs;
  jobSteps: typeof jobSteps;
  maciInstances: typeof maciInstances;
}>;

type MaciInstanceRow = typeof maciInstances.$inferSelect;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function asStatus(value: string): JobStatus {
  if (value === "running" || value === "succeeded" || value === "failed") {
    return value;
  }

  throw new Error(`unknown job status ${value}`);
}

function asStep(row: { seq: number; kind: string; name: string }): JobStep {
  return { seq: row.seq, kind: row.kind, name: row.name };
}

function asNetwork(value: string): MaciNetwork {
  if (value === "starknet_local") {
    return "starknet_local";
  }

  if (value === "sepolia") {
    return value;
  }

  throw new Error(`unknown MACI network ${value}`);
}

function asMaci(row: MaciInstanceRow): DeployMaciResult {
  return {
    leanImt: row.leanImt,
    checker: row.checker,
    enforcer: row.enforcer,
    assigner: row.assigner,
    pollClassHash: row.pollClassHash,
    pollFactoryClassHash: row.pollFactoryClassHash,
    maci: row.maci,
    pollFactory: row.pollFactory,
    coordinator: row.coordinator,
    deployer: row.deployer,
    network: asNetwork(row.network),
  };
}

/** Postgres persistence for MACI stand-up jobs and recorded instances. */
export class PostgresJobStore implements JobStore {
  readonly #db: JobDatabase;

  constructor(db: JobDatabase) {
    this.#db = db;
  }

  async tryBegin(job: NewJob): Promise<boolean> {
    try {
      await this.#db.insert(jobs).values({
        id: job.id,
        kind: job.kind,
        status: "running",
        createdAtMs: job.createdAtMs,
      });

      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }

  async appendStep(jobId: string, step: JobStep): Promise<void> {
    await this.#db.insert(jobSteps).values({
      jobId,
      seq: step.seq,
      kind: step.kind,
      name: step.name,
    });
  }

  async succeed(jobId: string, completedAtMs: number, maci: DeployMaciResult): Promise<void> {
    await this.#db.transaction(async (tx) => {
      await tx.update(jobs).set({ status: "succeeded", completedAtMs }).where(eq(jobs.id, jobId));
      await tx.insert(maciInstances).values({
        leanImt: maci.leanImt,
        checker: maci.checker,
        enforcer: maci.enforcer,
        assigner: maci.assigner,
        pollClassHash: maci.pollClassHash,
        pollFactoryClassHash: maci.pollFactoryClassHash,
        maci: maci.maci,
        pollFactory: maci.pollFactory,
        coordinator: maci.coordinator,
        deployer: maci.deployer,
        jobId,
        network: maci.network,
        createdAtMs: completedAtMs,
      });
    });
  }

  async fail(jobId: string, completedAtMs: number, error: string): Promise<void> {
    await this.#db.update(jobs).set({ status: "failed", completedAtMs, error }).where(eq(jobs.id, jobId));
  }

  async latest(): Promise<JobSnapshot | undefined> {
    const rows = await this.#db.select().from(jobs).orderBy(desc(jobs.createdAtMs)).limit(1);

    if (rows.length === 0) {
      return undefined;
    }

    const row = rows[0];

    const steps = await this.#db.select().from(jobSteps).where(eq(jobSteps.jobId, row.id)).orderBy(jobSteps.seq);

    return {
      id: row.id,
      kind: "standup",
      status: asStatus(row.status),
      error: row.error ?? undefined,
      steps: steps.map((step) => asStep(step)),
    };
  }

  async listMacis(pagination: Pagination): Promise<Page<MaciListItem>> {
    const totals = await this.#db.select({ total: count() }).from(maciInstances);
    const rows = await this.#db
      .select()
      .from(maciInstances)
      .orderBy(desc(maciInstances.id))
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize);

    return {
      items: rows.map((row): MaciListItem => ({
        address: row.maci,
        network: asMaci(row).network,
      })),
      total: totals[0]?.total ?? 0,
    };
  }

  async readMaci(address: string): Promise<DeployMaciResult | undefined> {
    const rows = await this.#db.select().from(maciInstances).where(eq(maciInstances.maci, address)).limit(1);

    if (rows.length === 0) {
      return undefined;
    }

    return asMaci(rows[0]);
  }
}
